// ============================================
// IR PUDDING TRACKING - SETTINGS
// ============================================

function initSettings() {
    console.log('⚙️ Settings module loaded');
}

async function loadSettings() {
    if (!isOwner()) return;

    try {
        const snap = await dbRef.settings.once('value');
        const settings = snap.val() || {};

        document.getElementById('setBizName').value = settings.businessName || 'IR Pudding';
        document.getElementById('setBizAddress').value = settings.address || '';
        document.getElementById('setBizPhone').value = settings.phone || '';
        document.getElementById('setBizGSTIN').value = settings.gstin || '';
        document.getElementById('setGSTRate').value = settings.gstRate || 5;
        document.getElementById('setUPI').value = settings.upiNumber || '9611920271';
        document.getElementById('setBankDetails').value = settings.bankDetails || '';
        document.getElementById('setWhatsAppTemplate').value = settings.whatsappTemplate || getDefaultWhatsAppTemplate();

        // Load expense categories
        await loadSettingsCategories();

        // Load recipe config
        await loadRecipeSettings();

        // Load users list for settings main page
        await loadSettingsUsersList();

    } catch (e) {
        console.error('Settings load error:', e);
    }
}

async function saveBusinessProfile() {
    try {
        await dbRef.settings.update({
            businessName: document.getElementById('setBizName').value.trim(),
            address: document.getElementById('setBizAddress').value.trim(),
            phone: document.getElementById('setBizPhone').value.trim(),
            gstin: document.getElementById('setBizGSTIN').value.trim()
        });
        showToast('Business profile saved!', 'success');
    } catch (e) {
        showToast('Error saving profile', 'error');
    }
}

async function saveTaxConfig() {
    try {
        await dbRef.settings.update({
            gstRate: parseFloat(document.getElementById('setGSTRate').value) || 5
        });
        showToast('Tax configuration saved!', 'success');
    } catch (e) {
        showToast('Error saving tax config', 'error');
    }
}

async function saveWhatsAppTemplate() {
    try {
        await dbRef.settings.update({
            upiNumber: document.getElementById('setUPI').value.trim(),
            bankDetails: document.getElementById('setBankDetails').value.trim(),
            whatsappTemplate: document.getElementById('setWhatsAppTemplate').value
        });
        showToast('WhatsApp template saved!', 'success');
    } catch (e) {
        showToast('Error saving template', 'error');
    }
}

function previewWhatsAppTemplate() {
    const template = document.getElementById('setWhatsAppTemplate').value;
    const upi = document.getElementById('setUPI').value;
    const bankDetails = document.getElementById('setBankDetails').value;

    let message = template
        .replace(/{customer_name}/g, 'Krishna Stores')
        .replace(/{invoice_no}/g, 'IR-2025-001')
        .replace(/{pending_amount}/g, '2,500')
        .replace(/{delivery_date}/g, formatDate(Date.now()))
        .replace(/{upi}/g, upi || '9611920271');

    if (bankDetails) {
        message = message.replace(/{bank_details}/g, '\n🏦 *Bank Details:*\n' + bankDetails);
    } else {
        message = message.replace(/{bank_details}/g, '');
    }

    const overlay = document.getElementById('waPreviewOverlay');
    document.getElementById('waPreviewContent').textContent = message;
    overlay.style.display = 'flex';
}

function resetWhatsAppTemplate() {
    document.getElementById('setWhatsAppTemplate').value = getDefaultWhatsAppTemplate();
    document.getElementById('setUPI').value = '9611920271';
    document.getElementById('setBankDetails').value = '';
    showToast('Template reset to default', 'info');
}

// ---- Expense Categories Management ----
async function loadSettingsCategories() {
    const container = document.getElementById('expenseCategoriesList');
    if (!container) return;

    try {
        const snap = await dbRef.expenseCategories.once('value');
        const categories = snap.val() || {};

        container.innerHTML = Object.entries(categories).map(([key, cat]) => `
            <span class="category-tag">
                ${cat.name}
                <button class="remove-cat" onclick="removeExpenseCategory('${key}')">
                    <i class="fas fa-times"></i>
                </button>
            </span>
        `).join('');
    } catch (e) { /* ignore */ }
}

async function addExpenseCategory() {
    const input = document.getElementById('newExpenseCategory');
    const name = input.value.trim();
    if (!name) return;

    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    try {
        await dbRef.expenseCategories.child(key).set({
            name, icon: 'fas fa-tag'
        });
        input.value = '';
        loadSettingsCategories();
        showToast(`Category "${name}" added!`, 'success');
    } catch (e) {
        showToast('Error adding category', 'error');
    }
}

async function removeExpenseCategory(key) {
    const confirmed = await confirmAction('Remove this expense category?');
    if (!confirmed) return;

    try {
        await dbRef.expenseCategories.child(key).remove();
        loadSettingsCategories();
        showToast('Category removed', 'success');
    } catch (e) {
        showToast('Error removing category', 'error');
    }
}

// ---- Recipe Settings ----
async function loadRecipeSettings() {
    const container = document.getElementById('recipeConfig');
    if (!container) return;

    try {
        const [prodSnap, recipeSnap] = await Promise.all([
            dbRef.products.once('value'),
            dbRef.recipes.once('value')
        ]);

        const products = prodSnap.val() || {};
        const recipes = recipeSnap.val() || {};

        if (Object.keys(products).length === 0) {
            container.innerHTML = '<p class="no-data">Add products first to configure recipes</p>';
            return;
        }

        container.innerHTML = Object.entries(products).map(([id, prod]) => {
            const recipe = recipes[id] || {};
            const ingredientCount = Object.keys(recipe).length;

            return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-light)">
                    <div>
                        <strong>${prod.name}</strong>
                        <br><small class="text-muted">${ingredientCount} ingredients configured</small>
                    </div>
                    <button class="btn-sm btn-outline" onclick="editRecipe('${id}','${prod.name}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p class="no-data">Error loading recipes</p>';
    }
}

// ---- Users List (Settings Main Page) ----
async function loadSettingsUsersList() {
    const container = document.getElementById('settingsUsersList');
    if (!container) return;

    try {
        const snap = await dbRef.users.once('value');
        const users = snap.val() || {};

        const roleLabels = {
            'owner': '👑 Owner',
            'staff_blr': '📍 Staff Bangalore',
            'staff_chn': '📍 Staff Chennai',
            'pending': '⏳ Pending Approval'
        };

        const usersHtml = Object.entries(users).map(([uid, u]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-light);font-size:0.9rem">
                <div>
                    <strong>${u.name || 'Unknown'}</strong>
                    <br><small class="text-muted">${u.email || uid.substring(0, 12) + '...'}</small>
                </div>
                <div>
                    <span class="status ${u.role === 'owner' ? 'status-ok' : u.role === 'pending' ? 'status-pending' : 'status-placed'}">
                        ${roleLabels[u.role] || u.role}
                    </span>
                </div>
            </div>
        `).join('');

        container.innerHTML = usersHtml || '<p class="no-data" style="margin: 0; padding: 0;">No active users</p>';
    } catch (e) {
        container.innerHTML = '<p class="no-data">Error loading users</p>';
    }
}

// ---- Backup ----
async function backupAllData() {
    showToast('Preparing backup...', 'info');

    try {
        const wb = XLSX.utils.book_new();

        // Backup each collection
        const collections = [
            { ref: 'customers', name: 'Customers' },
            { ref: 'orders', name: 'Orders' },
            { ref: 'payments', name: 'Payments' },
            { ref: 'purchases', name: 'Purchases' },
            { ref: 'expenses', name: 'Expenses' },
            { ref: 'suppliers', name: 'Suppliers' },
            { ref: 'staff', name: 'Staff' },
            { ref: 'salary_logs', name: 'Salary Logs' },
            { ref: 'transfers', name: 'Transfers' }
        ];

        for (const col of collections) {
            try {
                const snap = await db.ref(col.ref).once('value');
                const data = snap.val() || {};

                const rows = Object.entries(data).map(([id, item]) => {
                    // Flatten nested objects
                    const flat = { id };
                    Object.entries(item).forEach(([key, val]) => {
                        if (typeof val === 'object' && val !== null) {
                            flat[key] = JSON.stringify(val);
                        } else {
                            flat[key] = val;
                        }
                    });
                    return flat;
                });

                if (rows.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(rows);
                    XLSX.utils.book_append_sheet(wb, ws, col.name);
                }
            } catch (e) { /* skip if error */ }
        }

        // Stock data (separate sheet)
        try {
            const stockSnap = await dbRef.stock.once('value');
            const stockData = stockSnap.val() || {};
            const stockRows = [];

            Object.entries(stockData).forEach(([location, types]) => {
                Object.entries(types || {}).forEach(([type, items]) => {
                    Object.entries(items || {}).forEach(([key, item]) => {
                        stockRows.push({
                            Location: location,
                            Type: type,
                            Key: key,
                            Name: item.name,
                            Qty: item.qty,
                            Unit: item.unit,
                            Threshold: item.threshold
                        });
                    });
                });
            });

            if (stockRows.length > 0) {
                const ws = XLSX.utils.json_to_sheet(stockRows);
                XLSX.utils.book_append_sheet(wb, ws, 'Stock');
            }
        } catch (e) { /* skip */ }

        XLSX.writeFile(wb, `IR_Pudding_Backup_${getTodayStr()}.xlsx`);
        showToast('Full backup exported successfully! 📥', 'success');
    } catch (e) {
        console.error('Backup error:', e);
        showToast('Error creating backup', 'error');
    }
}

console.log('⚙️ Settings module loaded');
