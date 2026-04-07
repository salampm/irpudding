// ============================================
// IR PUDDING TRACKING - SETTINGS
// ============================================

function initSettings() {
    console.log('⚙️ Settings module loaded');
}

async function loadSettings() {
    try {
        if (isOwner()) {
            const snap = await dbRef.settings.once('value');
            const settings = snap.val() || {};

            document.getElementById('setBizName').value = settings.businessName || 'IR Pudding';
            document.getElementById('setBizAddress').value = settings.address || '';
            document.getElementById('setBizPhone').value = settings.phone || '';
            document.getElementById('setGSTRate').value = settings.gstRate || 5;
            document.getElementById('setUPI').value = settings.upiNumber || '9611920271';
            document.getElementById('setWhatsAppTemplate').value = settings.whatsappTemplate || getDefaultWhatsAppTemplate();

            await loadSettingsCategories();
            await loadRecipeSettings();
            await loadSettingsUsersList();
        }

        // Load current user profile
        const userSnap = await dbRef.users.child(currentUser.uid).once('value');
        const userData = userSnap.val() || {};
        const profileNameInput = document.getElementById('setUserProfileName');
        if (profileNameInput) profileNameInput.value = userData.name || '';

    } catch (e) {
        console.error('Settings load error:', e);
    }
}

async function saveUserProfile() {
    const name = document.getElementById('setUserProfileName').value.trim();
    const newPass = document.getElementById('setUserProfilePass').value.trim();

    if (!name) {
        showToast('Name is required', 'error');
        return;
    }

    try {
        await dbRef.users.child(currentUser.uid).update({ name });
        if (newPass) {
            if (newPass.length < 6) {
                showToast('Password must be at least 6 characters', 'error');
                return;
            }
            await firebase.auth().currentUser.updatePassword(newPass);
            document.getElementById('setUserProfilePass').value = '';
        }
        showToast('Profile updated successfully!', 'success');
    } catch (e) {
        showToast('Error updating profile: ' + e.message, 'error');
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

// ---- Expense Categories Management (Thumbnail Grid) ----
async function loadSettingsCategories() {
    const container = document.getElementById('expenseCategoriesList');
    if (!container) return;

    try {
        const snap = await dbRef.expenseCategories.once('value');
        const categories = snap.val() || {};

        container.innerHTML = Object.entries(categories).map(([key, cat]) => `
            <div class="category-card" onclick="editExpenseCategoryName('${key}', '${cat.name}')">
                <i class="fas fa-tag"></i>
                <div class="name">${cat.name}</div>
                <button class="delete-btn" onclick="event.stopPropagation(); removeExpenseCategory('${key}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (e) { /* ignore */ }
}

async function editExpenseCategoryName(key, currentName) {
    const newName = prompt('Enter new category name:', currentName);
    if (!newName || newName.trim() === '' || newName === currentName) return;
    
    try {
        await dbRef.expenseCategories.child(key).update({ name: newName.trim() });
        loadSettingsCategories();
        showToast('Category renamed', 'success');
    } catch (e) {
        showToast('Error renaming', 'error');
    }
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
            <div class="user-list-row" onclick="editUserByOwner('${uid}', ${JSON.stringify(u).replace(/"/g, '&quot;')})" style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid var(--border-light);cursor:pointer;transition:background 0.2s;border-radius:4px" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='transparent'">
                <div>
                    <strong>${u.name || 'Unknown'} ${uid === currentUser.uid ? '(You)' : ''}</strong>
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

async function editUserByOwner(uid, u) {
    if (uid === currentUser.uid) {
        // Switch to profile tab
        const profileBtn = document.querySelector('[data-sub="set-profile"]');
        if (profileBtn) switchSubTab(profileBtn, 'set-profile');
        return;
    }

    const newName = prompt(`Edit Name for ${u.email}:`, u.name || '');
    if (newName === null) return;

    const newRole = prompt(`Edit Role for ${u.email} (owner, staff_blr, staff_chn):`, u.role);
    if (newRole === null) return;

    try {
        await dbRef.users.child(uid).update({
            name: newName.trim(),
            role: newRole.trim()
        });
        showToast('User updated', 'success');
        loadSettingsUsersList();
    } catch (e) {
        showToast('Error updating user', 'error');
    }
}

// ---- Backup (Cleaned up Excel) ----
async function backupAllData() {
    showToast('Preparing backup...', 'info');

    try {
        const wb = XLSX.utils.book_new();

        // Ensure we always have sheets even if data is empty
        const ensureSheet = (rows, name) => {
            const dataRows = rows.length > 0 ? rows : [{ 'Note': 'No data available' }];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataRows), name);
        };

        // 1. Orders
        const ordSnap = await dbRef.orders.once('value');
        const orders = ordSnap.val() || {};
        const ordRows = Object.values(orders).map(o => ({
            'Invoice No': o.invoiceNo,
            'Date': o.date,
            'Customer': o.customerName,
            'Location': o.customerLocation || o.location,
            'Grand Total': o.total,
            'Paid Amount': o.paidAmount,
            'Pending': (o.total || 0) - (o.paidAmount || 0),
            'Status': o.status,
            'Payment Mode': o.lastPaymentType
        }));
        ensureSheet(ordRows, 'Sales_Orders');

        // 2. Customers
        const custSnap = await dbRef.customers.once('value');
        const customers = custSnap.val() || {};
        const custRows = Object.values(customers).map(c => ({
            'Name': c.name,
            'Phone': c.phone,
            'Location': c.location,
            'GSTIN': c.gstin || 'N/A',
            'Wallet Balance': c.walletBalance || 0
        }));
        ensureSheet(custRows, 'Customers');

        // 3. Stock Items
        const stockSnap = await dbRef.stock.once('value');
        const stockData = stockSnap.val() || {};
        const stockRows = [];
        Object.entries(stockData).forEach(([loc, types]) => {
            Object.entries(types || {}).forEach(([type, items]) => {
                Object.values(items || {}).forEach(i => {
                    stockRows.push({
                        'Location': loc,
                        'Category': type,
                        'Item Name': i.name,
                        'Current Qty': i.qty,
                        'Unit': i.unit,
                        'Low Stock Alert': i.threshold
                    });
                });
            });
        });
        ensureSheet(stockRows, 'Inventory');

        // 4. Expenses
        const expSnap = await dbRef.expenses.once('value');
        const expenses = expSnap.val() || {};
        const expRows = Object.values(expenses).map(e => ({
            'Date': e.date,
            'Category': e.category,
            'Amount': e.amount,
            'Description': e.description,
            'Location': e.location
        }));
        ensureSheet(expRows, 'Expenses');

        // 5. Inventory Ledger
        const invSnap = await dbRef.inventoryLedger.once('value');
        const invLogs = invSnap.val() || {};
        const invRows = Object.values(invLogs).map(l => ({
            'Date': l.date,
            'Timestamp': new Date(l.timestamp).toLocaleString(),
            'Product': l.productName,
            'Size': l.size,
            'Action': l.action,
            'Qty': l.qty,
            'Location': l.location,
            'By': l.by
        }));
        ensureSheet(invRows, 'Inventory_Ledger');

        // 6. Wastage Logs
        const wasteSnap = await dbRef.wastage.once('value');
        const wasteLogs = wasteSnap.val() || {};
        const wasteRows = Object.values(wasteLogs).map(w => ({
            'Date': w.date || '',
            'Product': w.productName,
            'Size': w.size,
            'Qty': w.qty,
            'Reason': w.reason,
            'Location': w.location,
            'By': w.loggedBy
        }));
        ensureSheet(wasteRows, 'Wastage_Logs');

        XLSX.writeFile(wb, `IR_Pudding_Full_Backup_${getTodayStr()}.xlsx`);
        showToast('Full backup exported! 📥', 'success');
    } catch (e) {
        console.error('Backup error:', e);
        showToast('Error creating backup', 'error');
    }
}

console.log('⚙️ Settings module loaded');
