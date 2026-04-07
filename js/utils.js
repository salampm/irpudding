// ============================================
// IR PUDDING TRACKING - UTILITIES
// ============================================

// ---- Toast Notification ----
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    // Set type
    toast.className = 'toast show ' + type;

    // Set icon
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    toastIcon.className = icons[type] || icons.success;

    // Set message
    toastMsg.textContent = message;

    // Auto hide after 3s
    clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ---- Modal ----
function openModal(type, data = null) {
    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    // Generate modal content based on type
    const modalContent = getModalContent(type, data);
    title.textContent = modalContent.title;
    body.innerHTML = modalContent.html;

    // Evaluate injected scripts manually as innerHTML does not run scripts
    const scripts = body.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        eval(scripts[i].innerText);
    }

    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Focus first input
    setTimeout(() => {
        const firstInput = body.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
    }, 100);
}

function closeModal(event) {
    if (event && event.target && !event.target.classList.contains('modal-overlay')) return;
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
}

// Close on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ---- Format Currency ----
function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ---- Format Date ----
function formatDate(timestamp) {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(timestamp) {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function getMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ---- Generate Unique ID ----
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ---- Filter Table ----
function filterTable(tableId, query) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    const q = query.toLowerCase();

    rows.forEach(row => {
        if (row.querySelector('.no-data')) return;
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

// ---- Excel Export ----
function exportToExcel(data, filename, sheetName = 'Sheet1') {
    if (!data || data.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-width columns
    const colWidths = Object.keys(data[0]).map(key => {
        const maxLen = Math.max(
            key.length,
            ...data.map(row => String(row[key] || '').length)
        );
        return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}_${getTodayStr()}.xlsx`);
    showToast('Exported to Excel successfully!', 'success');
}

// ---- WhatsApp Send ----
function sendWhatsApp(phone, message) {
    // Clean phone number
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    // Add India country code if not present
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
    if (!cleanPhone.startsWith('91')) cleanPhone = '91' + cleanPhone;

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`;
    window.open(url, '_blank');
}

// ---- Build WhatsApp Reminder Message ----
async function buildReminderMessage(customerName, invoiceNo, pendingAmount, deliveryDate) {
    // Get template from settings
    let template = '';
    let upi = '9611920271';
    let bankDetails = '';

    try {
        const snap = await dbRef.settings.once('value');
        const settings = snap.val() || {};
        template = settings.whatsappTemplate || getDefaultWhatsAppTemplate();
        upi = settings.upiNumber || '9611920271';
        bankDetails = settings.bankDetails || '';
    } catch (e) {
        template = getDefaultWhatsAppTemplate();
    }

    // Replace placeholders
    let message = template
        .replace(/{customer_name}/g, customerName || 'Customer')
        .replace(/{invoice_no}/g, invoiceNo || 'N/A')
        .replace(/{pending_amount}/g, pendingAmount || '0')
        .replace(/{delivery_date}/g, deliveryDate || '-')
        .replace(/{upi}/g, upi);

    // Handle bank details
    if (bankDetails) {
        message = message.replace(/{bank_details}/g, '\n🏦 *Bank Details:*\n' + bankDetails);
    } else {
        message = message.replace(/{bank_details}/g, '');
    }

    return message;
}

function getDefaultWhatsAppTemplate() {
    return `🍮 *IR Pudding* 🍮

Dear {customer_name},

Greetings from IR Pudding!

This is a friendly reminder regarding a pending payment on your account.

📄 *Invoice No:* {invoice_no}
💰 *Pending Amount:* ₹{pending_amount}
📅 *Delivery Date:* {delivery_date}

We kindly request you to settle the balance at your earliest convenience.

💳 *Payment Options:*
• *UPI:* {upi}
• Cash
• Bank Transfer
{bank_details}

If already paid, please ignore this message. 🙏

Thank you for your continued partnership!

Warm regards,
*Team IR Pudding*`;
}

// ---- Debounce ----
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// ---- Capitalize ----
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ---- Format Location ----
function formatLocation(loc) {
    if (loc === 'all') return 'All Locations';
    return capitalize(loc);
}

// ---- Get Status HTML ----
function getStatusBadge(status) {
    const classes = {
        'ok': 'status-ok',
        'low': 'status-low',
        'critical': 'status-critical',
        'pending': 'status-pending',
        'partial': 'status-partial',
        'settled': 'status-settled',
        'paid': 'status-paid',
        'placed': 'status-placed',
        'delivered': 'status-delivered'
    };
    return `<span class="status ${classes[status] || ''}">${capitalize(status)}</span>`;
}

let _confirmPromise = null;
function confirmAction(message, title = '⚠️ Confirm Action') {
    return new Promise((resolve) => {
        _confirmPromise = resolve;
        openModal('confirm', { message, title });
    });
}
window.handleConfirm = function(result) {
    if (typeof closeModal === 'function') closeModal();
    if (_confirmPromise) {
        _confirmPromise(result);
        _confirmPromise = null;
    }
}

console.log('🛠️ Utils module loaded');
