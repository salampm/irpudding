// ============================================
// IR PUDDING TRACKING - POS / ORDERS
// ============================================

function initPOS() {
    console.log('🧾 POS module loaded');
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

async function onOrderCustomerChange() {
    const select = document.getElementById('modalOrdCustomer');
    const customerId = select.value;
    const container = document.getElementById('orderProductsList');

    if (!customerId || !container) {
        if (container) container.innerHTML = '<p class="text-muted">Select a customer first</p>';
        return;
    }

    try {
        const [prodSnap, custSnap] = await Promise.all([
            dbRef.products.once('value'),
            dbRef.customers.child(customerId).once('value')
        ]);

        const products = prodSnap.val() || {};
        const customer = custSnap.val() || {};
        const customPrices = customer.customPrices || {};

        let html = '';
        Object.entries(products).forEach(([id, prod]) => {
            if (prod.active === false) return;
            const sizes = prod.sizes || { small: 100, big: 150 };

            Object.entries(sizes).forEach(([size, ml]) => {
                const priceKey = `${id}_${size}`;
                const price = customPrices[priceKey] || 0;

                html += `
                    <div class="form-row" style="margin-bottom:6px;align-items:center">
                        <div style="flex:3">
                            <span style="font-size:0.85rem">${prod.name} - ${capitalize(size)} (${ml}ml)</span>
                            ${isOwner() && price ? `<small class="text-muted"> · ₹${price}</small>` : ''}
                        </div>
                        <div style="flex:1">
                            <input type="number" class="order-qty-input" data-product="${id}"
                                   data-productname="${prod.name}" data-size="${size}"
                                   data-price="${price}" data-ml="${ml}"
                                   min="0" step="1" value="0" placeholder="Qty"
                                   onchange="calcOrderTotal()" oninput="calcOrderTotal()">
                        </div>
                    </div>
                `;
            });
        });

        container.innerHTML = html || '<p class="no-data">No products available</p>';
    } catch (e) {
        container.innerHTML = '<p class="no-data">Error loading products</p>';
    }
}

function calcOrderTotal() {
    const inputs = document.querySelectorAll('.order-qty-input');
    let total = 0;

    inputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        const price = parseFloat(input.dataset.price) || 0;
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
    const notes = document.getElementById('modalOrdNotes').value.trim();

    if (!customerId) {
        showToast('Please select a customer', 'error');
        return;
    }

    // Collect items
    const inputs = document.querySelectorAll('.order-qty-input');
    const items = [];
    let subtotal = 0;

    inputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            const price = parseFloat(input.dataset.price) || 0;
            items.push({
                productId: input.dataset.product,
                productName: input.dataset.productname,
                size: input.dataset.size,
                ml: input.dataset.ml,
                qty,
                price,
                lineTotal: qty * price
            });
            subtotal += qty * price;
        }
    });

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
            invoiceNo, date, items,
            subtotal, gstAmount, gstApplied: isGST,
            total,
            status: 'placed',
            paymentStatus: 'pending',
            paidAmount: 0,
            notes,
            createdBy: currentUser.uid,
            createdAt: Date.now()
        });

        // Deduct stock based on recipes
        await deductStockForOrder(items, customerLocation || currentLocation);

        closeModal();
        showToast('Order placed successfully!', 'success');
        loadOrders();
    } catch (e) {
        console.error('Save order error:', e);
        showToast('Error placing order', 'error');
    }
}

async function deductStockForOrder(items, location) {
    try {
        const recipeSnap = await dbRef.recipes.once('value');
        const recipes = recipeSnap.val() || {};

        for (const item of items) {
            const recipe = recipes[item.productId];
            if (!recipe) continue;

            for (const [ingredient, amounts] of Object.entries(recipe)) {
                const perPiece = amounts.qty_per_piece || 0;
                const totalDeduct = perPiece * item.qty;

                if (totalDeduct > 0) {
                    const loc = location || 'bangalore';
                    // Try food first, then nonfood
                    for (const type of ['food', 'nonfood']) {
                        const ref = dbRef.stock.child(`${loc}/${type}/${ingredient}/qty`);
                        const snap = await ref.once('value');
                        if (snap.exists()) {
                            const currentQty = parseFloat(snap.val()) || 0;
                            await ref.set(Math.max(0, currentQty - totalDeduct));
                            break;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('Stock deduction error:', e);
        // Don't block order - just log error
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

console.log('🧾 POS module loaded');
