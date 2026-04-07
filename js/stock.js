// ============================================
// IR PUDDING TRACKING - STOCK MANAGEMENT
// ============================================

function initStock() {
    console.log('📦 Stock module loaded');
}

async function loadStock(type) {
    const loc = getActiveLocation();
    const locations = loc === 'all' ? ['bangalore', 'chennai'] : [loc];
    let tbody;
    if (type === 'food') tbody = document.getElementById('stockFoodBody');
    else if (type === 'nonfood') tbody = document.getElementById('stockNonFoodBody');
    else if (type === 'staff') tbody = document.getElementById('stockStaffBody');

    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">Loading...</td></tr>';

    let allItems = [];

    for (const location of locations) {
        try {
            const snap = await dbRef.stock.child(`${location}/${type}`).once('value');
            const items = snap.val() || {};

            Object.entries(items).forEach(([key, item]) => {
                allItems.push({ key, location, type, ...item });
            });
        } catch (e) {
            console.error('Stock load error:', e);
        }
    }

    if (allItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No items found. Click "Add Item" to start.</td></tr>';
        return;
    }

    // Get suppliers for each item
    let suppliersMap = {};
    try {
        const supSnap = await dbRef.suppliers.once('value');
        const suppliers = supSnap.val() || {};
        Object.entries(suppliers).forEach(([id, sup]) => {
            if (sup.items) {
                const itemsList = sup.items.split(',').map(i => i.trim().toLowerCase());
                itemsList.forEach(item => {
                    if (!suppliersMap[item]) suppliersMap[item] = [];
                    suppliersMap[item].push(sup.name);
                });
            }
        });
    } catch (e) { /* ignore */ }

    tbody.innerHTML = allItems.map(item => {
        const status = !item.threshold ? 'ok' :
            item.qty <= item.threshold * 0.5 ? 'critical' :
            item.qty <= item.threshold ? 'low' : 'ok';

        const itemSuppliers = suppliersMap[item.name.toLowerCase()] || [];

        return `
            <tr>
                <td>
                    <strong>${item.name}</strong>
                    ${loc === 'all' ? `<br><small class="text-muted">${capitalize(item.location)}</small>` : ''}
                </td>
                <td><strong>${item.qty || 0}</strong></td>
                <td>${item.unit || '-'}</td>
                <td>${item.threshold || '-'}</td>
                <td>${itemSuppliers.length > 0 ? itemSuppliers.join(', ') : '<span class="text-muted">-</span>'}</td>
                <td>${getStatusBadge(status)}</td>
                <td>
                    <div style="display:flex;gap:4px">
                        <button class="btn-icon" title="Adjust stock" onclick='openModal("adjustStock", ${JSON.stringify({key:item.key, name:item.name, qty:item.qty, unit:item.unit, location:item.location, type:item.type})})'>
                            <i class="fas fa-sliders-h"></i>
                        </button>
                        <button class="btn-icon" title="Edit" onclick='openModal("editStock", ${JSON.stringify(item)})'>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" title="Delete" onclick="deleteStockItem('${item.location}','${item.type}','${item.key}','${item.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function saveStockItem(type) {
    const name = document.getElementById('modalItemName').value.trim();
    const qty = parseFloat(document.getElementById('modalItemQty').value) || 0;
    const unit = document.getElementById('modalItemUnit').value;
    const threshold = parseFloat(document.getElementById('modalItemThreshold').value) || 0;
    const location = document.getElementById('modalItemLocation').value;

    if (!name) {
        showToast('Please enter item name', 'error');
        return;
    }

    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const itemData = { name, qty, unit, threshold, type };

    try {
        if (location === 'both') {
            await dbRef.stock.child(`bangalore/${type}/${key}`).set(itemData);
            await dbRef.stock.child(`chennai/${type}/${key}`).set(itemData);
        } else {
            await dbRef.stock.child(`${location}/${type}/${key}`).set(itemData);
        }

        closeModal();
        showToast(`${name} added successfully!`, 'success');
        loadStock(type);
    } catch (e) {
        console.error('Save stock error:', e);
        showToast('Error saving item', 'error');
    }
}

async function updateStockItem() {
    const key = document.getElementById('modalEditKey').value;
    const loc = document.getElementById('modalEditLoc').value;
    const type = document.getElementById('modalEditType').value;
    const name = document.getElementById('modalItemName').value.trim();
    const qty = parseFloat(document.getElementById('modalItemQty').value) || 0;
    const unit = document.getElementById('modalItemUnit').value || document.getElementById('modalItemUnit').options?.[document.getElementById('modalItemUnit').selectedIndex]?.value;
    const threshold = parseFloat(document.getElementById('modalItemThreshold').value) || 0;

    if (!name) {
        showToast('Please enter item name', 'error');
        return;
    }

    try {
        await dbRef.stock.child(`${loc}/${type}/${key}`).update({ name, qty, unit, threshold });
        closeModal();
        showToast(`${name} updated!`, 'success');
        loadStock(type);
    } catch (e) {
        showToast('Error updating item', 'error');
    }
}

async function adjustStockQty() {
    const key = document.getElementById('modalAdjKey').value;
    const loc = document.getElementById('modalAdjLoc').value;
    const type = document.getElementById('modalAdjType').value;
    const action = document.getElementById('modalAdjAction').value;
    const adjQty = parseFloat(document.getElementById('modalAdjQty').value) || 0;

    if (adjQty <= 0 && action !== 'set') {
        showToast('Please enter a valid quantity', 'error');
        return;
    }

    try {
        const snap = await dbRef.stock.child(`${loc}/${type}/${key}/qty`).once('value');
        const currentQty = parseFloat(snap.val()) || 0;

        let newQty;
        if (action === 'add') newQty = currentQty + adjQty;
        else if (action === 'remove') newQty = Math.max(0, currentQty - adjQty);
        else newQty = adjQty;

        await dbRef.stock.child(`${loc}/${type}/${key}/qty`).set(newQty);

        closeModal();
        showToast(`Stock adjusted: ${currentQty} → ${newQty}`, 'success');
        loadStock(type);
    } catch (e) {
        showToast('Error adjusting stock', 'error');
    }
}

async function deleteStockItem(location, type, key, name) {
    const confirmed = await confirmAction(`Delete "${name}" from ${capitalize(location)}?`);
    if (!confirmed) return;

    try {
        await dbRef.stock.child(`${location}/${type}/${key}`).remove();
        showToast(`${name} deleted`, 'success');
        loadStock(type);
    } catch (e) {
        showToast('Error deleting item', 'error');
    }
}

// ---- Suppliers ----
async function loadSuppliers() {
    const tbody = document.getElementById('suppliersBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="no-data">Loading...</td></tr>';

    try {
        const snap = await dbRef.suppliers.once('value');
        const suppliers = snap.val() || {};

        if (Object.keys(suppliers).length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">No suppliers yet</td></tr>';
            return;
        }

        // Calculate outstanding per supplier from purchases
        let supplierOutstanding = {};
        const purSnap = await dbRef.purchases.once('value');
        const purchases = purSnap.val() || {};

        Object.values(purchases).forEach(p => {
            if (p.paymentStatus !== 'paid' && p.supplier) {
                const total = (parseFloat(p.qty) || 0) * (parseFloat(p.price) || 0);
                const paid = parseFloat(p.paidAmount) || 0;
                const supKey = p.supplierId || p.supplier;
                supplierOutstanding[supKey] = (supplierOutstanding[supKey] || 0) + (total - paid);
            }
        });

        tbody.innerHTML = Object.entries(suppliers).map(([id, sup]) => `
            <tr>
                <td><strong>${sup.name}</strong></td>
                <td>${sup.phone || '-'}</td>
                <td>${sup.items || '-'}</td>
                ${isOwner() ? `<td class="text-danger"><strong>${formatCurrency(supplierOutstanding[id] || 0)}</strong></td>` : ''}
                <td>
                    <div style="display:flex;gap:4px">
                        <button class="btn-icon" title="Edit" onclick='editSupplier(${JSON.stringify({id, ...sup})})'>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" title="Delete" onclick="deleteSupplier('${id}','${sup.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">Error loading suppliers</td></tr>';
    }
}

async function saveSupplier() {
    const name = document.getElementById('modalSupName').value.trim();
    const phone = document.getElementById('modalSupPhone').value.trim();
    const items = document.getElementById('modalSupItems').value.trim();
    const notes = document.getElementById('modalSupNotes').value.trim();

    if (!name) {
        showToast('Please enter supplier name', 'error');
        return;
    }

    try {
        const key = generateId();
        await dbRef.suppliers.child(key).set({
            name, phone, items, notes,
            createdAt: Date.now()
        });

        closeModal();
        showToast(`Supplier "${name}" added!`, 'success');
        loadSuppliers();
    } catch (e) {
        showToast('Error saving supplier', 'error');
    }
}

async function deleteSupplier(id, name) {
    const confirmed = await confirmAction(`Delete supplier "${name}"?`);
    if (!confirmed) return;

    try {
        await dbRef.suppliers.child(id).remove();
        showToast(`${name} deleted`, 'success');
        loadSuppliers();
    } catch (e) {
        showToast('Error deleting supplier', 'error');
    }
}

console.log('📦 Stock module loaded');
