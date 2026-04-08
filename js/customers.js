// ============================================
// IR PUDDING TRACKING - CUSTOMERS
// ============================================

function initCustomers() {
    console.log('👥 Customers module loaded');
}

async function loadCustomers() {
    const tbody = document.getElementById('customersBody');
    if (!tbody) return;

    const loc = getActiveLocation();
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">Loading...</td></tr>';

    try {
        const snap = await dbRef.customers.once('value');
        const customers = snap.val() || {};

        let filtered = Object.entries(customers)
            .map(([id, c]) => ({ id, ...c }))
            .filter(c => loc === 'all' || c.location === loc)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No customers yet</td></tr>';
            return;
        }

        // Calculate outstanding per customer
        let outstanding = {};
        const orderSnap = await dbRef.orders.once('value');
        const orders = orderSnap.val() || {};

        Object.values(orders).forEach(o => {
            if (o.status === 'delivered' && (o.paymentStatus === 'pending' || o.paymentStatus === 'partial')) {
                const total = parseFloat(o.total) || 0;
                const paid = parseFloat(o.paidAmount) || 0;
                const custId = o.customerId;
                if (custId) outstanding[custId] = (outstanding[custId] || 0) + (total - paid);
            }
        });

        tbody.innerHTML = filtered.map(c => `
            <tr>
                <td data-label="Name">
                    <strong>${c.name}</strong>
                    ${c.address ? `<br><small class="text-muted">${c.address.substring(0, 30)}...</small>` : ''}
                </td>
                <td data-label="Phone">${c.phone || '-'}</td>
                <td data-label="Location"><span class="status status-placed">${capitalize(c.location)}</span></td>
                <td data-label="GST">${c.gst ? '<span class="status status-ok">Yes</span>' : '<span class="text-muted">No</span>'}</td>
                ${isOwner() ? `<td data-label="Outstanding" class="${(outstanding[c.id] || 0) > 0 ? 'text-danger' : ''}"><strong>${formatCurrency(outstanding[c.id] || 0)}</strong></td>` : ''}
                <td data-label="Actions">
                    <div style="display:flex;gap:4px;justify-content:flex-end;width:100%">
                        ${isOwner() ? `
                            <button class="btn-icon" title="Set Prices" onclick='openModal("customerPricing", ${JSON.stringify({id:c.id, name:c.name})})'>
                                <i class="fas fa-tag"></i>
                            </button>
                        ` : ''}
                        <button class="btn-icon" title="Edit" onclick='editCustomer(${JSON.stringify(c)})'>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" title="Delete" onclick="deleteCustomer('${c.id}','${c.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Error loading customers</td></tr>';
        console.error('Customers error:', e);
    }
}

async function saveCustomer() {
    const name = document.getElementById('modalCustName').value.trim();
    const phone = document.getElementById('modalCustPhone').value.trim();
    const location = document.getElementById('modalCustLocation').value;
    const address = document.getElementById('modalCustAddress').value.trim();
    const gst = document.getElementById('modalCustGST').checked;
    const gstin = gst ? (document.getElementById('modalCustGSTIN').value.trim()) : '';
    const notes = document.getElementById('modalCustNotes').value.trim();

    if (!name || !phone) {
        showToast('Please enter name and phone', 'error');
        return;
    }

    try {
        const key = generateId();
        await dbRef.customers.child(key).set({
            name, phone, location, address,
            gst, gstin, notes,
            createdAt: Date.now()
        });

        closeModal();
        showToast(`Customer "${name}" added!`, 'success');
        loadCustomers();
    } catch (e) {
        showToast('Error saving customer', 'error');
    }
}

function editCustomer(customer) {
    openModal('addCustomer');
    setTimeout(() => {
        document.getElementById('modalTitle').textContent = '✏️ Edit Customer';
        document.getElementById('modalCustName').value = customer.name || '';
        document.getElementById('modalCustPhone').value = customer.phone || '';
        document.getElementById('modalCustLocation').value = customer.location || 'bangalore';
        document.getElementById('modalCustAddress').value = customer.address || '';
        document.getElementById('modalCustGST').checked = customer.gst || false;
        if (customer.gst) {
            document.getElementById('modalCustGSTINGroup').style.display = '';
            document.getElementById('modalCustGSTIN').value = customer.gstin || '';
        }
        document.getElementById('modalCustNotes').value = customer.notes || '';

        // Change save to update
        const saveBtn = document.querySelector('#modalBody .btn-primary');
        if (saveBtn) {
            saveBtn.onclick = async function () {
                const data = {
                    name: document.getElementById('modalCustName').value.trim(),
                    phone: document.getElementById('modalCustPhone').value.trim(),
                    location: document.getElementById('modalCustLocation').value,
                    address: document.getElementById('modalCustAddress').value.trim(),
                    gst: document.getElementById('modalCustGST').checked,
                    gstin: document.getElementById('modalCustGST').checked ? document.getElementById('modalCustGSTIN').value.trim() : '',
                    notes: document.getElementById('modalCustNotes').value.trim()
                };

                if (!data.name) { showToast('Enter customer name', 'error'); return; }

                try {
                    await dbRef.customers.child(customer.id).update(data);
                    closeModal();
                    showToast('Customer updated!', 'success');
                    loadCustomers();
                } catch (e) { showToast('Error updating', 'error'); }
            };
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Update';
        }
    }, 100);
}

async function deleteCustomer(id, name) {
    const confirmed = await confirmAction(`Delete customer "${name}"? This will not delete their orders.`);
    if (!confirmed) return;

    try {
        await dbRef.customers.child(id).remove();
        showToast(`${name} deleted`, 'success');
        loadCustomers();
    } catch (e) {
        showToast('Error deleting customer', 'error');
    }
}

// ---- Customer Pricing ----
async function loadCustomerPricingForm(customerId) {
    const container = document.getElementById('customerPriceList');
    if (!container) return;

    try {
        const [prodSnap, custSnap] = await Promise.all([
            dbRef.products.once('value'),
            dbRef.customers.child(customerId).child('customPrices').once('value')
        ]);

        const products = prodSnap.val() || {};
        const currentPrices = custSnap.val() || {};

        let html = '';
        Object.entries(products).forEach(([id, prod]) => {
            if (prod.active === false) return;
            const sizes = prod.sizes || { small: 100, big: 150 };

            html += `<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">
                <label style="font-weight:600;margin-bottom:6px;display:block">${prod.name}</label>
                <div class="form-row">`;

            Object.entries(sizes).forEach(([size, ml]) => {
                const priceKey = `${id}_${size}`;
                html += `
                    <div class="form-group" style="margin-bottom:4px">
                        <label style="font-size:0.75rem">${capitalize(size)} (${ml}ml) - ₹</label>
                        <input type="number" class="cust-price-input" data-key="${priceKey}"
                               value="${currentPrices[priceKey] || ''}"
                               placeholder="Price" min="0" step="0.5">
                    </div>`;
            });

            html += `</div></div>`;
        });

        container.innerHTML = html || '<p class="no-data">No products available</p>';
    } catch (e) {
        container.innerHTML = '<p class="no-data">Error loading products</p>';
    }
}

async function saveCustomerPrices() {
    const customerId = document.getElementById('modalPriceCustomerId').value;
    const inputs = document.querySelectorAll('.cust-price-input');
    const prices = {};

    inputs.forEach(input => {
        const val = parseFloat(input.value);
        if (val > 0) {
            prices[input.dataset.key] = val;
        }
    });

    try {
        await dbRef.customers.child(customerId).child('customPrices').set(prices);
        closeModal();
        showToast('Customer prices saved!', 'success');
    } catch (e) {
        showToast('Error saving prices', 'error');
    }
}

console.log('👥 Customers module loaded');
