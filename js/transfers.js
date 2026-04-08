// ============================================
// IR PUDDING TRACKING - STOCK TRANSFERS
// ============================================

function initTransfers() {
    console.log('🔄 Transfers module loaded');
}

async function loadTransfers() {
    const tbody = document.getElementById('transfersBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="no-data">Loading...</td></tr>';

    try {
        const snap = await dbRef.transfers.once('value');
        const transfers = snap.val() || {};

        const list = Object.entries(transfers)
            .map(([id, t]) => ({ id, ...t }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No transfers yet</td></tr>';
            return;
        }

        const currentLoc = getActiveLocation();

        tbody.innerHTML = list.map(t => {
            const itemsSummary = (t.items || []).map(i => `${i.name}: ${i.qty}`).join(', ');
            const isInTransit = t.status === 'in-transit';
            // Staff of the destination location OR Owner can confirm
            const canConfirm = isInTransit && (currentRole === ROLES.OWNER || currentLocation === t.to);

            return `
                <tr>
                    <td data-label="Date">${formatDate(t.date)}</td>
                    <td data-label="From"><span class="status status-placed">${capitalize(t.from)}</span></td>
                    <td data-label="To"><span class="status status-delivered">${capitalize(t.to)}</span></td>
                    <td data-label="Items">${itemsSummary || '-'}</td>
                    <td data-label="Status">
                        <span class="status ${isInTransit ? 'status-pending' : 'status-ok'}">
                            ${isInTransit ? '<i class="fas fa-truck"></i> In-Transit' : '✅ Received'}
                        </span>
                    </td>
                    <td data-label="Actions">
                        <div style="display:flex;gap:4px;justify-content:flex-end;width:100%">
                            ${canConfirm ? `
                                <button class="btn-sm btn-primary" onclick="confirmTransfer('${t.id}')">
                                    <i class="fas fa-check"></i> Confirm Receipt
                                </button>
                            ` : ''}
                            ${isOwner() ? `
                                <button class="btn-icon danger" title="Delete" onclick="deleteTransfer('${t.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Error loading transfers</td></tr>';
    }
}

async function confirmTransfer(id) {
    if (!await confirmAction('Confirm that you have received all items in this transfer?')) return;

    try {
        const trfSnap = await dbRef.transfers.child(id).once('value');
        const t = trfSnap.val();
        if (!t || t.status !== 'in-transit') return;

        // Update stock: add to destination
        for (const item of t.items) {
            const toRef = dbRef.stock.child(`${t.to}/${item.type}/${item.key}/qty`);
            const toSnap = await toRef.once('value');
            const toQty = parseFloat(toSnap.val()) || 0;
            await toRef.set(toQty + item.qty);
        }

        // Mark as completed
        await dbRef.transfers.child(id).update({
            status: 'completed',
            receivedBy: currentUser.uid,
            receivedAt: Date.now()
        });

        showToast('Stock received and inventory updated!', 'success');
        loadTransfers();
        if (typeof loadStock === 'function') loadStock('food');
    } catch (e) {
        showToast('Error confirming transfer', 'error');
    }
}

async function loadTransferItems() {
    const selects = document.querySelectorAll('.trf-item-select');
    // For transfer source, always use the current user's location (unless owner chooses)
    const loc = document.getElementById('modalTrfFrom')?.value || (currentRole === ROLES.OWNER ? 'bangalore' : currentLocation);

    try {
        const items = [];
        for (const type of ['food', 'nonfood', 'staff']) {
            const snap = await dbRef.stock.child(`${loc}/${type}`).once('value');
            const data = snap.val() || {};
            Object.entries(data).forEach(([key, item]) => {
                items.push({ key, name: item.name, unit: item.unit, type });
            });
        }

        selects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">Select item...</option>';
            items.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.key;
                opt.textContent = `${item.name} (${item.unit})`;
                opt.dataset.name = item.name;
                opt.dataset.type = item.type;
                select.appendChild(opt);
            });
            if (currentVal) select.value = currentVal;
        });
    } catch (e) { /* ignore */ }
}

function addTransferItemRow() {
    const container = document.getElementById('transferItemsContainer');
    const row = document.createElement('div');
    row.className = 'transfer-item-row';
    row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:end';
    row.innerHTML = `
        <div style="flex:2">
            <select class="trf-item-select" style="width:100%">
                <option value="">Select item...</option>
            </select>
        </div>
        <div style="flex:1">
            <input type="number" class="trf-item-qty" placeholder="Qty" min="0.1" step="0.1" style="width:100%">
        </div>
        <button class="btn-icon danger" onclick="this.parentElement.remove()" style="flex-shrink:0">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(row);
    loadTransferItems();
}

async function saveTransfer() {
    const date = document.getElementById('modalTrfDate').value;
    const from = document.getElementById('modalTrfFrom').value;
    const to = document.getElementById('modalTrfTo').value;
    const notes = document.getElementById('modalTrfNotes').value.trim();

    if (from === to) {
        showToast('From and To locations must be different', 'error');
        return;
    }

    // Collect items
    const rows = document.querySelectorAll('.transfer-item-row');
    const items = [];

    rows.forEach(row => {
        const select = row.querySelector('.trf-item-select');
        const qtyInput = row.querySelector('.trf-item-qty');
        if (select && qtyInput && select.value && parseFloat(qtyInput.value) > 0) {
            items.push({
                key: select.value,
                name: select.options[select.selectedIndex]?.dataset?.name || '',
                type: select.options[select.selectedIndex]?.dataset?.type || 'food',
                qty: parseFloat(qtyInput.value)
            });
        }
    });

    if (items.length === 0) {
        showToast('Please add at least one item to transfer', 'error');
        return;
    }

    try {
        // 1. Deduct stock from source immediately
        for (const item of items) {
            const fromRef = dbRef.stock.child(`${from}/${item.type}/${item.key}/qty`);
            const fromSnap = await fromRef.once('value');
            const fromQty = parseFloat(fromSnap.val()) || 0;
            
            if (fromQty < item.qty) {
                showToast(`Insufficient stock for ${item.name} at ${capitalize(from)}`, 'error');
                return;
            }
            await fromRef.set(fromQty - item.qty);
        }

        // 2. Save transfer record as in-transit
        const trfId = generateId();
        await dbRef.transfers.child(trfId).set({
            date, from, to, items, notes,
            status: 'in-transit',
            createdBy: currentUser.uid,
            createdAt: Date.now()
        });

        closeModal();
        showToast('Transfer started! Status: In-Transit', 'success');
        loadTransfers();
    } catch (e) {
        console.error('Transfer error:', e);
        showToast('Error processing transfer', 'error');
    }
}

async function deleteTransfer(id) {
    const confirmed = await confirmAction('Delete this transfer record? (Stock will NOT be reverted)');
    if (!confirmed) return;

    try {
        await dbRef.transfers.child(id).remove();
        showToast('Transfer record deleted', 'success');
        loadTransfers();
    } catch (e) {
        showToast('Error deleting transfer', 'error');
    }
}

console.log('🔄 Transfers module loaded');
