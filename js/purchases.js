// ============================================
// IR PUDDING TRACKING - PURCHASES
// ============================================

function initPurchases() {
    console.log('🛒 Purchases module loaded');
}

async function loadPurchases() {
    const tbody = document.getElementById('purchasesBody');
    if (!tbody) return;

    const loc = getActiveLocation();
    tbody.innerHTML = '<tr><td colspan="8" class="no-data">Loading...</td></tr>';

    try {
        const snap = await dbRef.purchases.once('value');
        const purchases = snap.val() || {};

        let filtered = Object.entries(purchases)
            .map(([id, p]) => ({ id, ...p }))
            .filter(p => loc === 'all' || p.location === loc)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No purchases yet</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            const total = (parseFloat(p.qty) || 0) * (parseFloat(p.price) || 0);
            return `
                <tr>
                    <td data-label="Date">${formatDate(p.date)}</td>
                    <td data-label="Supplier">${p.supplierName || p.supplier || '-'}</td>
                    <td data-label="Item">${p.itemName || p.item || '-'}</td>
                    <td data-label="Qty">${p.qty || 0} ${p.unit || ''}</td>
                    ${isOwner() ? `<td data-label="Price">${formatCurrency(p.price)}</td>` : ''}
                    ${isOwner() ? `<td data-label="Total"><strong>${formatCurrency(total)}</strong></td>` : ''}
                    ${isOwner() ? `<td data-label="Payment">${getStatusBadge(p.paymentStatus || 'pending')}</td>` : ''}
                    <td data-label="Actions">
                        <div style="display:flex;gap:4px;justify-content:flex-end;width:100%">
                            <button class="btn-icon danger" title="Delete" onclick="deletePurchase('${p.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">Error loading purchases</td></tr>';
    }
}

async function loadPurchaseDropdowns() {
    // Load suppliers dropdown
    try {
        const supSnap = await dbRef.suppliers.once('value');
        const suppliers = supSnap.val() || {};
        const supSelect = document.getElementById('modalPurSupplier');
        if (supSelect) {
            Object.entries(suppliers).forEach(([id, sup]) => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = sup.name;
                opt.dataset.name = sup.name;
                supSelect.appendChild(opt);
            });
        }
    } catch (e) { /* ignore */ }

    // Load stock items dropdown
    try {
        const loc = currentRole === ROLES.OWNER ? 'bangalore' : currentLocation;
        const allItems = [];

        for (const type of ['food', 'nonfood']) {
            const snap = await dbRef.stock.child(`${loc}/${type}`).once('value');
            const items = snap.val() || {};
            Object.entries(items).forEach(([key, item]) => {
                allItems.push({ key, name: item.name, unit: item.unit, type });
            });
        }

        const itemSelect = document.getElementById('modalPurItem');
        if (itemSelect) {
            allItems.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.key;
                opt.textContent = `${item.name} (${item.unit})`;
                opt.dataset.name = item.name;
                opt.dataset.unit = item.unit;
                opt.dataset.type = item.type;
                itemSelect.appendChild(opt);
            });
        }
    } catch (e) { /* ignore */ }
}

async function savePurchase() {
    const date = document.getElementById('modalPurDate').value;
    const supplierSelect = document.getElementById('modalPurSupplier');
    const supplierId = supplierSelect.value;
    const supplierName = supplierSelect.options[supplierSelect.selectedIndex]?.dataset?.name || '';
    const itemSelect = document.getElementById('modalPurItem');
    const itemKey = itemSelect.value;
    const itemName = itemSelect.options[itemSelect.selectedIndex]?.dataset?.name || '';
    const itemUnit = itemSelect.options[itemSelect.selectedIndex]?.dataset?.unit || '';
    const itemType = itemSelect.options[itemSelect.selectedIndex]?.dataset?.type || 'food';
    const qty = parseFloat(document.getElementById('modalPurQty').value) || 0;
    const price = parseFloat(document.getElementById('modalPurPrice').value) || 0;
    const location = document.getElementById('modalPurLocation').value;
    const payStatus = document.getElementById('modalPurPayStatus').value;
    const paidAmt = payStatus === 'partial' ? parseFloat(document.getElementById('modalPurPaidAmt').value) || 0 : (payStatus === 'paid' ? qty * price : 0);
    const addToStock = document.getElementById('modalPurAddToStock').checked;

    if (!date || !supplierId || !itemKey || qty <= 0) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        // Save purchase
        const purchaseId = generateId();
        await dbRef.purchases.child(purchaseId).set({
            date, supplierId, supplierName, item: itemKey, itemName, unit: itemUnit,
            qty, price, total: qty * price,
            location, paymentStatus: payStatus, paidAmount: paidAmt,
            createdBy: currentUser.uid,
            createdAt: Date.now()
        });

        // Add to stock if checked
        if (addToStock) {
            const stockRef = dbRef.stock.child(`${location}/${itemType}/${itemKey}/qty`);
            const currentSnap = await stockRef.once('value');
            const currentQty = parseFloat(currentSnap.val()) || 0;
            await stockRef.set(currentQty + qty);
        }

        closeModal();
        showToast('Purchase recorded!', 'success');
        loadPurchases();
    } catch (e) {
        console.error('Save purchase error:', e);
        showToast('Error saving purchase', 'error');
    }
}

async function deletePurchase(id) {
    const confirmed = await confirmAction('Delete this purchase record?');
    if (!confirmed) return;

    try {
        await dbRef.purchases.child(id).remove();
        showToast('Purchase deleted', 'success');
        loadPurchases();
    } catch (e) {
        showToast('Error deleting purchase', 'error');
    }
}

function filterPurchases() {
    // Client-side filtering
    const dateFrom = document.getElementById('purchaseDateFrom').value;
    const dateTo = document.getElementById('purchaseDateTo').value;
    const supplier = document.getElementById('purchaseSupplierFilter').value;
    const payment = document.getElementById('purchasePaymentFilter').value;

    const rows = document.querySelectorAll('#purchasesBody tr');
    rows.forEach(row => {
        if (row.querySelector('.no-data')) return;
        const cells = row.querySelectorAll('td');
        const rowDate = cells[0]?.textContent || '';
        const rowSupplier = cells[1]?.textContent || '';
        const rowPayment = row.innerHTML.toLowerCase();

        let show = true;
        // Simple filter logic - for dates we'd need proper parsing
        if (supplier && !rowSupplier.toLowerCase().includes(supplier.toLowerCase())) show = false;
        if (payment && !rowPayment.includes(payment)) show = false;

        row.style.display = show ? '' : 'none';
    });
}

console.log('🛒 Purchases module loaded');
