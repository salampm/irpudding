// ============================================
// IR PUDDING TRACKING - PAYMENTS
// ============================================

let currentPaymentFilter = 'pending';

function initPayments() {
    console.log('💰 Payments module loaded');
}

async function loadPayments() {
    const container = document.getElementById('paymentsContainer');
    if (!container || !isOwner()) return;

    const loc = getActiveLocation();
    container.innerHTML = '<p class="no-data">Loading...</p>';

    try {
        const snap = await dbRef.orders.once('value');
        const orders = snap.val() || {};

        // Get customer data for phone numbers
        const custSnap = await dbRef.customers.once('value');
        const customers = custSnap.val() || {};

        let filtered = Object.entries(orders)
            .map(([id, o]) => ({ id, ...o }))
            .filter(o => {
                if (o.status !== 'delivered') return false;
                if (loc !== 'all' && o.location !== loc) return false;

                if (currentPaymentFilter === 'pending') return o.paymentStatus === 'pending';
                if (currentPaymentFilter === 'partial') return o.paymentStatus === 'partial';
                if (currentPaymentFilter === 'settled') return o.paymentStatus === 'settled' || o.paymentStatus === 'paid';

                return true;
            })
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // Update count
        const pendingCount = Object.values(orders).filter(o =>
            o.status === 'delivered' && o.paymentStatus === 'pending' &&
            (loc === 'all' || o.location === loc)
        ).length;
        const countEl = document.getElementById('pendingCount');
        if (countEl) countEl.textContent = pendingCount;

        if (filtered.length === 0) {
            container.innerHTML = `<p class="no-data">No ${currentPaymentFilter} payments</p>`;
            return;
        }

        container.innerHTML = filtered.map(o => {
            const total = parseFloat(o.total) || 0;
            const paid = parseFloat(o.paidAmount) || 0;
            const pending = total - paid;
            const customerPhone = customers[o.customerId]?.phone || '';

            return `
                <div class="payment-card">
                    <div class="customer-info">
                        <h3>${o.customerName || 'Unknown'}</h3>
                        <p>Invoice: <strong>${o.invoiceNo || 'N/A'}</strong> · ${formatDate(o.date)}</p>
                        <p>Total: ${formatCurrency(total)} ${paid > 0 ? `· Paid: ${formatCurrency(paid)}` : ''}</p>
                        ${o.lastPaymentType ? `<p class="text-muted" style="margin-top:4px"><i class="fas fa-wallet"></i> Mode: <span class="status status-partial">${capitalize(o.lastPaymentType).replace('_', ' ')}</span></p>` : ''}
                    </div>
                    <div class="amount">${formatCurrency(pending)}</div>
                    <div class="actions">
                        ${o.paymentStatus !== 'settled' && o.paymentStatus !== 'paid' ? `
                            <button class="btn-success btn-sm" onclick='openModal("recordPayment", ${JSON.stringify({
                                orderId: o.id,
                                customerId: o.customerId,
                                customerName: o.customerName,
                                invoiceNo: o.invoiceNo,
                                pendingAmount: pending
                            })})'>
                                <i class="fas fa-check"></i> Record Payment
                            </button>
                            <button class="btn-whatsapp btn-sm" onclick="sendReminder('${o.customerId}', '${customerPhone}', '${o.invoiceNo || 'N/A'}', ${pending}, '${o.date || ''}')">
                                <i class="fab fa-whatsapp"></i> Remind
                            </button>
                        ` : `
                            <span class="status status-settled">✅ Settled</span>
                        `}
                        ${isOwner() ? `
                            <button class="btn-danger btn-sm" onclick="voidOrder('${o.id}')" style="margin-left:auto">
                                <i class="fas fa-trash"></i> Void Order
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p class="no-data">Error loading payments</p>';
        console.error('Payments error:', e);
    }
}

function filterPayments(status, btn) {
    currentPaymentFilter = status;
    document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadPayments();
}

async function recordPayment() {
    const orderId = document.getElementById('modalPayOrderId').value;
    const cash = parseFloat(document.getElementById('payAmtCash').value) || 0;
    const upi = parseFloat(document.getElementById('payAmtUPI').value) || 0;
    const bank = parseFloat(document.getElementById('payAmtBank').value) || 0;
    const date = document.getElementById('modalPayDate').value;
    const notes = document.getElementById('modalPayNotes').value.trim();

    const amount = cash + upi + bank;
    
    // Build payment type string
    let types = [];
    if (cash > 0) types.push('cash');
    if (upi > 0) types.push('upi');
    if (bank > 0) types.push('bank');
    const payType = types.map(t => capitalize(t)).join(', ') || 'Cash';

    if (amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    try {
        // Get current order and double check pending amount
        const orderSnap = await dbRef.orders.child(orderId).once('value');
        const order = orderSnap.val();
        if (!order) { showToast('Order not found', 'error'); return; }

        const total = parseFloat(order.total) || 0;
        const prevPaid = parseFloat(order.paidAmount) || 0;
        const currentPending = total - prevPaid;

        if (amount > currentPending + 0.1) {
            showToast('Amount exceeds pending balance', 'error');
            return;
        }

        const newPaid = prevPaid + amount;
        const remaining = total - newPaid;

        const paymentStatus = remaining <= 0.5 ? 'settled' : 'partial'; // 0.5 tolerance for rounding

        // Update order
        await dbRef.orders.child(orderId).update({
            paidAmount: newPaid,
            paymentStatus,
            lastPaymentDate: date,
            lastPaymentType: payType
        });

        // Log payment record
        const paymentId = generateId();
        await dbRef.payments.child(paymentId).set({
            orderId,
            customerId: order.customerId,
            customerName: order.customerName,
            invoiceNo: order.invoiceNo,
            amount, payType, 
            split: { cash, upi, bank },
            date, notes,
            createdAt: Date.now()
        });

        closeModal();
        showToast(`Payment of ${formatCurrency(amount)} recorded! ${paymentStatus === 'settled' ? '✅ Fully settled' : `Remaining: ${formatCurrency(remaining)}`}`, 'success');
        loadPayments();
    } catch (e) {
        console.error('Payment error:', e);
        showToast('Error recording payment', 'error');
    }
}

async function sendReminder(customerId, phone, invoiceNo, pendingAmount, deliveryDate) {
    if (!phone) {
        showToast('No phone number for this customer', 'warning');
        return;
    }

    try {
        // Get customer name
        const custSnap = await dbRef.customers.child(customerId).once('value');
        const customer = custSnap.val() || {};

        const message = await buildReminderMessage(
            customer.name || 'Customer',
            invoiceNo,
            pendingAmount.toFixed(2),
            formatDate(deliveryDate)
        );

        sendWhatsApp(phone, message);
    } catch (e) {
        showToast('Error sending reminder', 'error');
    }
}

// ---- Customer Ledger ----
async function initLedger() {
    const select = document.getElementById('ledgerCustomer');
    if (!select || select.options.length > 1) return;

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
                opt.textContent = c.name;
                select.appendChild(opt);
            });
    } catch (e) { /* ignore */ }
}

async function loadLedger() {
    const customerId = document.getElementById('ledgerCustomer').value;
    if (!customerId) return;

    const tbody = document.getElementById('ledgerBody');
    const summary = document.getElementById('ledgerSummary');

    tbody.innerHTML = '<tr><td colspan="6" class="no-data">Loading...</td></tr>';

    try {
        // Get all orders for this customer
        const orderSnap = await dbRef.orders.orderByChild('customerId').equalTo(customerId).once('value');
        const orders = orderSnap.val() || {};

        // Get all payments for this customer
        const paySnap = await dbRef.payments.orderByChild('customerId').equalTo(customerId).once('value');
        const payments = paySnap.val() || {};

        // Build ledger entries
        let entries = [];
        let totalBilled = 0;
        let totalPaid = 0;

        // Add order entries
        Object.entries(orders).forEach(([id, o]) => {
            totalBilled += parseFloat(o.total) || 0;
            entries.push({
                date: o.date,
                invoiceNo: o.invoiceNo || '-',
                type: 'Invoice',
                amount: parseFloat(o.total) || 0,
                notes: `${(o.items || []).length} items`
            });
        });

        // Add payment entries
        Object.entries(payments).forEach(([id, p]) => {
            totalPaid += parseFloat(p.amount) || 0;
            let payType = p.payType || 'Cash';
            let payDesc = payType.includes(',') || payType === 'mix' ? 'Split Payment' : payType;
            
            if (p.split && (p.split.cash || p.split.upi || p.split.bank)) {
                let parts = [];
                if (p.split.cash) parts.push('Cash: ' + p.split.cash);
                if (p.split.upi) parts.push('UPI: ' + p.split.upi);
                if (p.split.bank) parts.push('Bank: ' + p.split.bank);
                payDesc = 'Split (' + parts.join(', ') + ')';
            } else {
                payDesc = capitalize(payType);
            }
            entries.push({
                date: p.date,
                invoiceNo: p.invoiceNo || '-',
                type: 'Payment',
                amount: -(parseFloat(p.amount) || 0),
                notes: `${payDesc}${p.notes ? ' - ' + p.notes : ''}`
            });
        });

        // Sort by date
        entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        // Calculate running balance
        let balance = 0;
        entries.forEach(e => {
            balance += e.amount;
            e.balance = balance;
        });

        // Update summary
        if (summary) {
            summary.style.display = 'flex';
            document.getElementById('ledgerBilled').textContent = formatCurrency(totalBilled);
            document.getElementById('ledgerPaid').textContent = formatCurrency(totalPaid);
            document.getElementById('ledgerOutstanding').textContent = formatCurrency(totalBilled - totalPaid);
        }

        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No transactions found</td></tr>';
            return;
        }

        tbody.innerHTML = entries.map(e => `
            <tr>
                <td>${formatDate(e.date)}</td>
                <td>${e.invoiceNo}</td>
                <td>${e.type === 'Invoice' ?
                    '<span class="status status-pending">Invoice</span>' :
                    '<span class="status status-settled">Payment</span>'
                }</td>
                <td class="${e.amount >= 0 ? 'text-danger' : 'text-success'}">
                    ${e.amount >= 0 ? '+' : ''}${formatCurrency(Math.abs(e.amount))}
                </td>
                <td><strong>${formatCurrency(e.balance)}</strong></td>
                <td class="text-muted">${e.notes || '-'}</td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Error loading ledger</td></tr>';
        console.error('Ledger error:', e);
    }
}

async function exportLedger() {
    const customerId = document.getElementById('ledgerCustomer').value;
    if (!customerId) { showToast('Select a customer first', 'warning'); return; }

    const customerName = document.getElementById('ledgerCustomer').options[document.getElementById('ledgerCustomer').selectedIndex]?.textContent || 'Customer';

    const rows = document.querySelectorAll('#ledgerBody tr');
    const data = [];

    rows.forEach(row => {
        if (row.querySelector('.no-data')) return;
        const cells = row.querySelectorAll('td');
        data.push({
            Date: cells[0]?.textContent || '',
            'Invoice No': cells[1]?.textContent || '',
            Type: cells[2]?.textContent?.trim() || '',
            Amount: cells[3]?.textContent || '',
            Balance: cells[4]?.textContent || '',
            Notes: cells[5]?.textContent || ''
        });
    });

    exportToExcel(data, `Ledger_${customerName}`, 'Ledger');
}

console.log('💰 Payments module loaded');
