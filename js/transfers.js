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
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No transfers yet</td></tr>';
            return;
        }

        tbody.innerHTML = list.map(t => {
            const itemsSummary = (t.items || []).map(i => `${i.name}: ${i.qty}`).join(', ');
            return `
                <tr>
                    <td>${formatDate(t.date)}</td>
                    <td><span class="status status-placed">${capitalize(t.from)}</span></td>
                    <td><span class="status status-delivered">${capitalize(t.to)}</span></td>
                    <td>${itemsSummary || '-'}</td>
                    <td>${getStatusBadge(t.status || 'completed')}</td>
                    <td>
                        <button class="btn-icon danger" title="Delete" onclick="deleteTransfer('${t.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Error loading transfers</td></tr>';
    }
}

async function loadTransferItems() {
    const selects = document.querySelectorAll('.trf-item-select');
    const loc = currentRole === ROLES.OWNER ? 'bangalore' : currentLocation;

    try {
        const items = [];
        for (const type of ['food', 'nonfood']) {
            const snap = await dbRef.stock.child(`${loc}/${type}`).once('value');
            const data = snap.val() || {};
            Object.entries(data).forEach(([key, item]) => {
                items.push({ key, name: item.name, unit: item.unit, type });
            });
        }

        selects.forEach(select => {
            // Keep first option
            select.innerHTML = '<option value="">Select item...</option>';
            items.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.key;
                opt.textContent = `${item.name} (${item.unit})`;
                opt.dataset.name = item.name;
                opt.dataset.type = item.type;
                select.appendChild(opt);
            });
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
        // Save transfer record
        const trfId = generateId();
        await dbRef.transfers.child(trfId).set({
            date, from, to, items, notes,
            status: 'completed',
            createdBy: currentUser.uid,
            createdAt: Date.now()
        });

        // Update stock: deduct from source, add to destination
        for (const item of items) {
            const fromRef = dbRef.stock.child(`${from}/${item.type}/${item.key}/qty`);
            const toRef = dbRef.stock.child(`${to}/${item.type}/${item.key}/qty`);

            const fromSnap = await fromRef.once('value');
            const toSnap = await toRef.once('value');

            const fromQty = parseFloat(fromSnap.val()) || 0;
            const toQty = parseFloat(toSnap.val()) || 0;

            await fromRef.set(Math.max(0, fromQty - item.qty));
            await toRef.set(toQty + item.qty);
        }

        closeModal();
        showToast('Stock transferred successfully!', 'success');
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
