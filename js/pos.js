// ============================================
// IR PUDDING TRACKING - POS / ORDERS
// ============================================

function initPOS() {
    console.log('🧾 POS module loaded');
    loadAvailableDailyStock();
}

async function loadOrders() {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    const loc = getActiveLocation();
    container.innerHTML = '<p class="no-data">Loading orders...</p>';

    try {
        const snap = await dbRef.orders.once('value');
        const orders = snap.val() || {};

        let filtered = Object.entries(orders)
            .map(([id, o]) => ({ id, ...o }))
            .filter(o => loc === 'all' || o.location === loc)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (filtered.length === 0) {
            container.innerHTML = '<p class="no-data">No orders yet. Click "New Order" to start.</p>';
            return;
        }

        container.innerHTML = filtered.map(o => {
            const itemTags = (o.items || []).map(i =>
                `<span class="order-item-tag">${i.productName || i.productId} ${i.size ? '(' + capitalize(i.size) + ')' : ''} x${i.qty}</span>`
            ).join('');

            return `
                <div class="order-card ${o.status === 'delivered' ? 'delivered' : ''}">
                    <div class="order-card-header">
                        <h3>${o.customerName || 'Unknown'}</h3>
                        <div style="display:flex;gap:8px;align-items:center">
                            ${o.invoiceNo ? `<small class="text-muted">INV: ${o.invoiceNo}</small>` : ''}
                            ${getStatusBadge(o.status || 'placed')}
                        </div>
                    </div>
                    <div class="order-items">${itemTags}</div>
                    <div class="order-card-footer">
                        <small class="text-muted">
                            <i class="fas fa-calendar"></i> ${formatDate(o.date)}
                            ${o.location ? `· <i class="fas fa-map-marker-alt"></i> ${capitalize(o.location)}` : ''}
                        </small>
                        <div style="display:flex;gap:8px;align-items:center">
                            ${isOwner() ? `<strong>${formatCurrency(o.total)}</strong>` : ''}
                            ${o.status === 'placed' ? `
                                <button class="btn-success btn-sm" onclick="markDelivered('${o.id}')">
                                    <i class="fas fa-check"></i> Mark Delivered
                                </button>
                            ` : ''}
                            ${isOwner() ? `
                                <button class="btn-danger btn-sm" onclick="voidOrder('${o.id}')" title="Void and Delete">
                                    <i class="fas fa-trash"></i> Void
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p class="no-data">Error loading orders</p>';
        console.error('Orders error:', e);
    }
}

function filterOrders(status, btn) {
    if (btn) {
        document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
    }

    const cards = document.querySelectorAll('.order-card');
    cards.forEach(card => {
        if (status === 'all') {
            card.style.display = '';
        } else if (status === 'placed') {
            card.style.display = card.classList.contains('delivered') ? 'none' : '';
        } else if (status === 'delivered') {
            card.style.display = card.classList.contains('delivered') ? '' : 'none';
        }
    });
}

async function loadOrderCustomers() {
    const select = document.getElementById('modalOrdCustomer');
    if (!select) return;

    const loc = getActiveLocation();

    try {
        const snap = await dbRef.customers.once('value');
        const customers = snap.val() || {};

        Object.entries(customers)
            .filter(([id, c]) => loc === 'all' || c.location === loc)
            .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || ''))
            .forEach(([id, c]) => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = `${c.name} (${capitalize(c.location)})`;
                opt.dataset.name = c.name;
                opt.dataset.location = c.location;
                opt.dataset.gst = c.gst ? '1' : '0';
                select.appendChild(opt);
            });
    } catch (e) { /* ignore */ }
}

window._availableDailyStock = [];
window._currentOrderCustomerPrices = {};

async function loadAvailableDailyStock(targetLoc = null) {
    try {
        const stockSnap = await (dbRef.dailyStock ? dbRef.dailyStock.once('value') : firebase.database().ref('dailyStock').once('value'));
        const stock = stockSnap.val() || {};
        const loc = targetLoc || getActiveLocation();

        window._availableDailyStock = Object.entries(stock)
            .filter(([id, s]) => loc === 'all' || s.location === loc)
            .map(([id, s]) => ({ stockId: id, ...s }));
    } catch(e) {
        console.error("Error loading daily stock for order", e);
    }
}

async function onOrderCustomerChange() {
    const select = document.getElementById('modalOrdCustomer');
    const customerId = select.value;
    const container = document.getElementById('orderProductsList');

    if (!customerId || !container) {
        if (container) container.innerHTML = '<p class="text-muted">Select a customer first</p>';
        return;
    }
    
    // Get customer's location to filter stock
    const custLoc = select.options[select.selectedIndex]?.dataset?.location;
    await loadAvailableDailyStock(custLoc); // Ensure stock is fresh and filtered by customer location

    try {
        const custSnap = await dbRef.customers.child(customerId).once('value');
        const customer = custSnap.val() || {};
        window._currentOrderCustomerPrices = customer.customPrices || {};

        container.innerHTML = '';
        if (window._availableDailyStock.length === 0) {
            container.innerHTML = '<p class="no-data">No daily stock available to order</p>';
            return;
        }

        addOrderProductRow(); // auto-add first row
    } catch (e) {
        container.innerHTML = '<p class="no-data">Error loading customer details</p>';
    }
}

function addOrderProductRow() {
    const custSelect = document.getElementById('modalOrdCustomer');
    if (!custSelect || !custSelect.value) {
        showToast('Please select a customer first', 'warning');
        return;
    }

    const container = document.getElementById('orderProductsList');
    if (!container) return;
    
    if (window._availableDailyStock.length === 0) {
        showToast('No daily stock available to order', 'warning');
        return;
    }

    if (container.querySelector('.no-data') || container.querySelector('.text-muted')) {
        container.innerHTML = '';
    }

    const rowId = generateId();
    const row = document.createElement('div');
    row.className = 'form-row order-item-row';
    row.style.marginBottom = '8px';
    row.style.alignItems = 'center';
    row.id = `order_row_${rowId}`;

    let options = '<option value="">Select product...</option>';
    window._availableDailyStock.forEach(s => {
        options += `<option value="${s.stockId}">${s.productName} - ${capitalize(s.size)} (${s.ml}ml) [Avail: ${s.qty}]</option>`;
    });

    row.innerHTML = `
        <div style="flex:3">
            <select class="order-item-select" onchange="onOrderProductRowChange('${rowId}')" style="width:100%" data-row="${rowId}">
                ${options}
            </select>
        </div>
        <div style="flex:1">
            <input type="number" class="order-price-input" id="price_${rowId}"
                   min="0" step="0.5" placeholder="Price (₹)"
                   onchange="calcOrderTotal()" oninput="calcOrderTotal()">
        </div>
        <div style="flex:1">
            <input type="number" class="order-qty-input" id="qty_${rowId}"
                   min="0" step="1" placeholder="Qty"
                   onchange="calcOrderTotal()" oninput="calcOrderTotal()">
        </div>
        <div>
            <button class="btn-icon danger" onclick="document.getElementById('order_row_${rowId}').remove(); calcOrderTotal();">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    container.appendChild(row);
}

function onOrderProductRowChange(rowId) {
    const select = document.querySelector(`select[data-row="${rowId}"]`);
    const priceInput = document.getElementById(`price_${rowId}`);
    if (!select || !priceInput) return;

    const stockId = select.value;
    if (!stockId) {
        priceInput.value = '';
        return;
    }

    const s = window._availableDailyStock.find(x => x.stockId === stockId);
    if (!s) return;

    const priceKey = `${s.productId}_${s.size}`;
    const price = window._currentOrderCustomerPrices[priceKey] || '';
    priceInput.value = price;
    calcOrderTotal();
}

function calcOrderTotal() {
    const rows = document.querySelectorAll('.order-item-row');
    let total = 0;

    rows.forEach(row => {
        const qty = parseInt(row.querySelector('.order-qty-input').value) || 0;
        const price = parseFloat(row.querySelector('.order-price-input').value) || 0;
        total += qty * price;
    });

    // GST check
    const customerSelect = document.getElementById('modalOrdCustomer');
    const isGST = customerSelect.options[customerSelect.selectedIndex]?.dataset?.gst === '1';
    if (isGST) {
        total = total * 1.05; // 5% GST
    }

    const totalEl = document.getElementById('modalOrdTotal');
    if (totalEl) totalEl.textContent = formatCurrency(total);
}

async function saveOrder() {
    const customerSelect = document.getElementById('modalOrdCustomer');
    const customerId = customerSelect.value;
    const customerName = customerSelect.options[customerSelect.selectedIndex]?.dataset?.name || '';
    const customerLocation = customerSelect.options[customerSelect.selectedIndex]?.dataset?.location || '';
    const isGST = customerSelect.options[customerSelect.selectedIndex]?.dataset?.gst === '1';
    const invoiceNo = document.getElementById('modalOrdInvoice').value.trim();
    const date = document.getElementById('modalOrdDate').value;
    const deliveryDate = document.getElementById('modalOrdDeliveryDate').value;
    const notes = document.getElementById('modalOrdNotes').value.trim();

    if (!customerId) {
        showToast('Please select a customer', 'error');
        return;
    }

    // Collect items
    const rows = document.querySelectorAll('.order-item-row');
    const items = [];
    let subtotal = 0;
    let stockError = false;

    rows.forEach(row => {
        const select = row.querySelector('.order-item-select');
        const stockId = select ? select.value : null;
        if (!stockId) return;

        const s = window._availableDailyStock.find(x => x.stockId === stockId);
        if (!s) return;

        const price = parseFloat(row.querySelector('.order-price-input').value) || 0;
        const qty = parseInt(row.querySelector('.order-qty-input').value) || 0;

        if (qty > 0) {
            if (qty > s.qty) {
                showToast(`Not enough stock for ${s.productName}. Available: ${s.qty}`, 'error');
                stockError = true;
                return;
            }
            items.push({
                stockId: s.stockId,
                productId: s.productId,
                productName: s.productName,
                size: s.size,
                ml: s.ml,
                qty,
                price,
                lineTotal: qty * price
            });
            subtotal += qty * price;
        }
    });

    if (stockError) return;

    if (items.length === 0) {
        showToast('Please add at least one product', 'error');
        return;
    }

    const gstAmount = isGST ? subtotal * 0.05 : 0;
    const total = subtotal + gstAmount;

    try {
        const orderId = generateId();
        await dbRef.orders.child(orderId).set({
            customerId, customerName,
            location: customerLocation || (currentRole === ROLES.OWNER ? selectedLocation : currentLocation),
            invoiceNo, date, deliveryDate, items,
            subtotal, gstAmount, gstApplied: isGST,
            total,
            status: 'placed',
            paymentStatus: 'pending',
            paidAmount: 0,
            notes,
            createdBy: currentUser.uid,
            createdAt: Date.now()
        });

        // Deduct stock from daily stock
        await deductStockForOrder(items);

        closeModal();
        showToast('Order placed successfully!', 'success');
        loadOrders();
    } catch (e) {
        console.error('Save order error:', e);
        showToast('Error placing order', 'error');
    }
}

async function deductStockForOrder(items) {
    try {
        for (const item of items) {
            if (item.stockId) {
                const stockRef = dbRef.dailyStock ? dbRef.dailyStock.child(item.stockId) : firebase.database().ref('dailyStock').child(item.stockId);
                
                await stockRef.transaction(currentData => {
                    if (currentData) {
                        const currentQty = parseInt(currentData.qty) || 0;
                        currentData.qty = Math.max(0, currentQty - item.qty);
                        currentData.updatedAt = Date.now();
                    }
                    return currentData;
                });
            }
        }
    } catch (e) {
        console.error('Stock deduction error:', e);
    }
}

async function markDelivered(orderId) {
    try {
        await dbRef.orders.child(orderId).update({
            status: 'delivered',
            deliveredAt: Date.now(),
            deliveredBy: currentUser.uid
        });

        showToast('Order marked as delivered!', 'success');
        loadOrders();
    } catch (e) {
        showToast('Error updating order', 'error');
    }
}

async function voidOrder(orderId) {
    if (!orderId || !isOwner()) return;
    
    const msg = "⚠️ VOID ORDER?\n\nThis will:\n1. Delete this order permanently.\n2. Revert quantities back to Daily Inventory.\n3. Delete all associated payment records.\n\nAre you sure?";
    if (!(await confirmAction(msg, "Void Order?"))) return;

    try {
        // 1. Get order details for stock reversal
        const snap = await dbRef.orders.child(orderId).once('value');
        const order = snap.val();
        if (!order) return;

        // 2. Revert Stock
        const items = order.items || [];
        for (const item of items) {
            if (item.stockId) {
                const stockRef = dbRef.dailyStock ? dbRef.dailyStock.child(item.stockId) : firebase.database().ref('dailyStock').child(item.stockId);
                const sSnap = await stockRef.once('value');
                if (sSnap.exists()) {
                    const currentQty = parseInt(sSnap.val().qty) || 0;
                    await stockRef.update({ qty: currentQty + (item.qty || 0) });
                }
            }
        }

        // 3. Delete associated payments
        const paySnap = await dbRef.payments.orderByChild('orderId').equalTo(orderId).once('value');
        const pays = paySnap.val() || {};
        const payPromises = Object.keys(pays).map(id => dbRef.payments.child(id).remove());
        await Promise.all(payPromises);

        // 4. Delete Order
        await dbRef.orders.child(orderId).remove();

        showToast('Order voided and stock reverted!', 'success');
        
        // Reload views
        if (typeof loadOrders === 'function') loadOrders();
        if (typeof loadPayments === 'function') loadPayments();
        if (typeof loadLedger === 'function') loadLedger();
        
    } catch (e) {
        console.error('Void error:', e);
        showToast('Error voiding order', 'error');
    }
}

console.log('🧾 POS module loaded');
