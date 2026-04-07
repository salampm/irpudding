// ============================================
// IR PUDDING TRACKING - MAIN APP CONTROLLER
// ============================================

let currentActiveTab = 'dashboard';

// ---- Initialize App ----
function initApp() {
    console.log('🍮 Initializing IR Pudding Tracking...');

    // Set dashboard date
    const dashDate = document.getElementById('dashDate');
    if (dashDate) {
        dashDate.textContent = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    // Initialize all modules
    try {
        if (typeof initDashboard === 'function') initDashboard();
        if (typeof initStock === 'function') initStock();
        if (typeof initProducts === 'function') initProducts();
        if (typeof initCustomers === 'function') initCustomers();
        if (typeof initPOS === 'function') initPOS();
        if (typeof initPurchases === 'function') initPurchases();
        if (typeof initTransfers === 'function') initTransfers();
        if (typeof initPayments === 'function') initPayments();
        if (typeof initExpenses === 'function') initExpenses();
        if (typeof initSalary === 'function') initSalary();
        if (typeof initWastage === 'function') initWastage();
        if (typeof initReports === 'function') initReports();
        if (typeof initSettings === 'function') initSettings();
    } catch (e) {
        console.error('Module init error:', e);
    }

    // Load default data
    loadDefaultData();

    // Show default tab
    switchTab('dashboard', document.querySelector('[data-tab="dashboard"]'));

    console.log('✅ App initialized successfully');
}

// ---- Load Default Data ----
async function loadDefaultData() {
    try {
        // Default expense categories
        const catSnap = await dbRef.expenseCategories.once('value');
        if (!catSnap.exists()) {
            await dbRef.expenseCategories.set({
                raw_material: { name: 'Raw Material', icon: 'fas fa-carrot' },
                non_food: { name: 'Non-Food', icon: 'fas fa-box' },
                rent: { name: 'Rent', icon: 'fas fa-home' },
                electricity: { name: 'Electricity', icon: 'fas fa-bolt' },
                gst_payment: { name: 'GST Payment', icon: 'fas fa-percentage' },
                salary: { name: 'Salary', icon: 'fas fa-wallet' },
                transport: { name: 'Transport', icon: 'fas fa-truck' },
                other: { name: 'Other', icon: 'fas fa-ellipsis-h' }
            });
        }

        // Default settings
        const setSnap = await dbRef.settings.once('value');
        if (!setSnap.exists()) {
            await dbRef.settings.set({
                businessName: 'IR Pudding',
                address: '',
                phone: '',
                gstin: '',
                gstRate: 5,
                upiNumber: '9611920271',
                bankDetails: '',
                whatsappTemplate: getDefaultWhatsAppTemplate()
            });
        }

        // Default products
        const prodSnap = await dbRef.products.once('value');
        if (!prodSnap.exists()) {
            const defaultProducts = {
                tender_coconut: { name: 'Tender Coconut Pudding', sizes: { small: 100, big: 150 }, active: true, createdAt: Date.now() },
                mysore_pak: { name: 'Mysore Pak Pudding', sizes: { small: 100, big: 150 }, active: true, createdAt: Date.now() },
                custard_apple: { name: 'Custard Apple Pudding', sizes: { small: 100, big: 150 }, active: true, createdAt: Date.now() },
                mango: { name: 'Mango Pudding', sizes: { small: 100, big: 150 }, active: true, createdAt: Date.now() },
                strawberry: { name: 'Strawberry Pudding', sizes: { small: 100, big: 150 }, active: true, createdAt: Date.now() },
                caramel: { name: 'Caramel Pudding', sizes: { small: 100, big: 150 }, active: true, createdAt: Date.now() }
            };
            await dbRef.products.set(defaultProducts);
        }

        // Default Units
        const unitSnap = await dbRef.units.once('value');
        if (!unitSnap.exists()) {
            const defaultUnits = {
                pcs: { name: 'Pieces' },
                grams: { name: 'Grams' },
                kg: { name: 'Kg' },
                liters: { name: 'Liters' },
                ml: { name: 'Ml' },
                rolls: { name: 'Rolls' },
                packets: { name: 'Packets' },
                boxes: { name: 'Boxes' }
            };
            await dbRef.units.set(defaultUnits);
        }

        // Load units for global use
        dbRef.units.on('value', snap => {
            window.unitsData = snap.val() || {};
        });

        // Default food stock items
        const stockSnap = await dbRef.stock.once('value');
        if (!stockSnap.exists()) {
            const defaultFoodItems = {
                milk: { name: 'Milk', qty: 0, unit: 'Litres', threshold: 10, type: 'food' },
                badam: { name: 'Badam', qty: 0, unit: 'Kg', threshold: 2, type: 'food' },
                sugar: { name: 'Sugar', qty: 0, unit: 'Kg', threshold: 5, type: 'food' },
                chinagrass: { name: 'Chinagrass', qty: 0, unit: 'Kg', threshold: 1, type: 'food' },
                mango_pulp: { name: 'Mango Pulp', qty: 0, unit: 'Kg', threshold: 3, type: 'food' },
                custard_apple_pulp: { name: 'Custard Apple Pulp', qty: 0, unit: 'Kg', threshold: 3, type: 'food' },
                strawberry_crush: { name: 'Strawberry Crush', qty: 0, unit: 'Litres', threshold: 2, type: 'food' },
                mysore_pak: { name: 'Mysore Pak', qty: 0, unit: 'Kg', threshold: 2, type: 'food' },
                condensed_milk: { name: 'Condensed Milk', qty: 0, unit: 'Kg', threshold: 3, type: 'food' },
                tender_coconut: { name: 'Tender Coconut', qty: 0, unit: 'Pieces', threshold: 20, type: 'food' }
            };

            const defaultNonFoodItems = {
                container_small: { name: 'Plastic Container Small', qty: 0, unit: 'Pieces', threshold: 100, type: 'nonfood' },
                container_big: { name: 'Plastic Container Big', qty: 0, unit: 'Pieces', threshold: 100, type: 'nonfood' },
                disposable_spoons: { name: 'Disposable Spoons', qty: 0, unit: 'Pieces', threshold: 200, type: 'nonfood' },
                tape: { name: 'Tape', qty: 0, unit: 'Rolls', threshold: 5, type: 'nonfood' },
                plastic_cover: { name: 'Plastic Cover', qty: 0, unit: 'Pieces', threshold: 100, type: 'nonfood' }
            };

            await dbRef.stock.child('bangalore/food').set(defaultFoodItems);
            await dbRef.stock.child('bangalore/nonfood').set(defaultNonFoodItems);
            await dbRef.stock.child('chennai/food').set(defaultFoodItems);
            await dbRef.stock.child('chennai/nonfood').set(defaultNonFoodItems);
        }

    } catch (e) {
        console.error('Default data error:', e);
    }
}

// ---- Tab Navigation ----
function switchTab(tabName, navElement) {
    currentActiveTab = tabName;

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const targetTab = document.getElementById('tab-' + tabName);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    if (navElement) {
        navElement.classList.add('active');
    }

    if (window.innerWidth <= 768) {
        closeSidebar();
    }

    onTabSwitch(tabName);
}

function onTabSwitch(tabName) {
    switch (tabName) {
        case 'dashboard':
            if (typeof loadDashboard === 'function') loadDashboard();
            break;
        case 'stockFood':
            if (typeof loadStock === 'function') loadStock('food');
            break;
        case 'stockNonFood':
            if (typeof loadStock === 'function') loadStock('nonfood');
            break;
        case 'purchases':
            if (typeof loadPurchases === 'function') loadPurchases();
            break;
        case 'transfers':
            if (typeof loadTransfers === 'function') loadTransfers();
            break;
        case 'suppliers':
            if (typeof loadSuppliers === 'function') loadSuppliers();
            break;
        case 'products':
            if (typeof loadProducts === 'function') loadProducts();
            break;
        case 'dailyStock':
            if (typeof loadDailyStock === 'function') loadDailyStock();
            break;
        case 'customers':
            if (typeof loadCustomers === 'function') loadCustomers();
            break;
        case 'pos':
            if (typeof loadOrders === 'function') loadOrders();
            break;
        case 'payments':
            if (typeof loadPayments === 'function') loadPayments();
            break;
        case 'ledger':
            if (typeof initLedger === 'function') initLedger();
            break;
        case 'expenses':
            if (typeof loadExpenses === 'function') loadExpenses();
            break;
        case 'salary':
            if (typeof loadStaff === 'function') loadStaff();
            break;
        case 'reports':
            break;
        case 'inventoryLedger':
            if (typeof loadInventoryLedger === 'function') loadInventoryLedger();
            break;
        case 'wastage':
            if (typeof loadWastage === 'function') loadWastage();
            break;
        case 'settings':
            if (typeof loadSettings === 'function') loadSettings();
            break;
    }
}

// ---- Sidebar Toggle ----
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
}

// ---- Location Switcher (Owner) ----
function switchLocation(location, btn) {
    selectedLocation = location;

    document.querySelectorAll('.loc-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const badge = document.getElementById('headerLocation');
    if (badge) {
        if (location === 'all') badge.textContent = '🌐 All Locations';
        else if (location === 'bangalore') badge.textContent = '📍 Bangalore';
        else badge.textContent = '📍 Chennai';
    }

    onTabSwitch(currentActiveTab);
}

// ---- Modal Content Generator ----
function getModalContent(type, data) {
    // Safety: if data is undefined, set to empty object to prevent crashes
    if (!data) data = {};
    
    switch (type) {
        case 'addStockFood':
            return {
                title: '➕ Add Food Ingredient',
                html: `
                    <div class="form-group">
                        <label>Item Name *</label>
                        <input type="text" id="modalItemName" placeholder="e.g., Milk" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Quantity</label>
                            <input type="number" id="modalItemQty" value="0" min="0" step="0.1">
                        </div>
                        <div class="form-group">
                            <label>Unit</label>
                            <select id="modalItemUnit">
                                <option value="Kg">Kg</option>
                                <option value="Litres">Litres</option>
                                <option value="Pieces">Pieces</option>
                                <option value="Grams">Grams</option>
                                <option value="ml">ml</option>
                                <option value="Packets">Packets</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Low Stock Threshold</label>
                        <input type="number" id="modalItemThreshold" value="5" min="0" step="0.5">
                    </div>
                    <div class="form-group">
                        <label>Location *</label>
                        <select id="modalItemLocation">
                            ${currentRole === ROLES.OWNER ?
                                '<option value="bangalore">Bangalore</option><option value="chennai">Chennai</option><option value="both">Both Locations</option>' :
                                '<option value="' + currentLocation + '">' + capitalize(currentLocation) + '</option>'
                            }
                        </select>
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveStockItem('food')"><i class="fas fa-save"></i> Save</button>
                    </div>
                `
            };

        case 'addStockNonFood':
            return {
                title: '➕ Add Non-Food Item',
                html: `
                    <div class="form-group">
                        <label>Item Name *</label>
                        <input type="text" id="modalItemName" placeholder="e.g., Plastic Container" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Quantity</label>
                            <input type="number" id="modalItemQty" value="0" min="0" step="1">
                        </div>
                        <div class="form-group">
                            <label>Unit</label>
                            <select id="modalItemUnit" class="units-dropdown">
                                <option value="Pieces">Pieces</option>
                            </select>
                        </div>
                    </div>
                    <script>
                        if(window.loadModalUnits) window.loadModalUnits();
                    </script>
                    <div class="form-group">
                        <label>Low Stock Threshold</label>
                        <input type="number" id="modalItemThreshold" value="50" min="0">
                    </div>
                    <div class="form-group">
                        <label>Location *</label>
                        <select id="modalItemLocation">
                            ${currentRole === ROLES.OWNER ?
                                '<option value="bangalore">Bangalore</option><option value="chennai">Chennai</option><option value="both">Both Locations</option>' :
                                '<option value="' + currentLocation + '">' + capitalize(currentLocation) + '</option>'
                            }
                        </select>
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveStockItem('nonfood')"><i class="fas fa-save"></i> Save</button>
                    </div>
                `
            };

        case 'addStockStaff':
            return {
                title: '➕ Add Staff Store Item',
                html: `
                    <div class="form-group">
                        <label>Item Name *</label>
                        <input type="text" id="modalItemName" placeholder="e.g., Apron, Safety Shoes" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Initial Quantity</label>
                            <input type="number" id="modalItemQty" value="0" min="0" step="0.1">
                        </div>
                        <div class="form-group">
                            <label>Unit</label>
                            <select id="modalItemUnit" class="units-dropdown">
                                <option value="Pieces">Pieces</option>
                            </select>
                        </div>
                    </div>
                    <script>
                        if(window.loadModalUnits) window.loadModalUnits();
                    </script>
                    <div class="form-group">
                        <label>Low Stock Threshold</label>
                        <input type="number" id="modalItemThreshold" value="5" min="0">
                    </div>
                    <div class="form-group">
                        <label>Location *</label>
                        <select id="modalItemLocation">
                            ${currentRole === ROLES.OWNER ?
                                '<option value="bangalore">Bangalore</option><option value="chennai">Chennai</option><option value="both" selected>Both Locations</option>' :
                                '<option value="' + currentLocation + '">' + capitalize(currentLocation) + '</option>'
                            }
                        </select>
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveStockItem('staff')"><i class="fas fa-save"></i> Save Item</button>
                    </div>
                `
            };

        case 'editStock':
            return {
                title: '✏️ Edit ' + (data.name || 'Item'),
                html: `
                    <input type="hidden" id="modalEditKey" value="${data.key}">
                    <input type="hidden" id="modalEditLoc" value="${data.location}">
                    <input type="hidden" id="modalEditType" value="${data.type}">
                    <div class="form-group">
                        <label>Item Name</label>
                        <input type="text" id="modalItemName" value="${data.name || ''}">
                    </div>
                        <div class="form-group">
                            <label>Quantity</label>
                            <input type="number" id="modalItemQty" value="${data.qty || 0}" min="0" step="0.1">
                        </div>
                        <div class="form-group">
                            <label>Unit</label>
                            <select id="modalItemUnit" class="units-dropdown" data-value="${data.unit || 'Pieces'}">
                                <option value="Pieces">Pieces</option>
                            </select>
                        </div>
                    </div>
                    <script>
                        if(window.loadModalUnits) window.loadModalUnits();
                    </script>
                    <div class="form-group">
                        <label>Low Stock Threshold</label>
                        <input type="number" id="modalItemThreshold" value="${data.threshold || 0}" min="0" step="0.5">
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="updateStockItem()"><i class="fas fa-save"></i> Update</button>
                    </div>
                `
            };

        case 'adjustStock':
            return {
                title: '📦 Adjust Stock - ' + (data.name || ''),
                html: `
                    <input type="hidden" id="modalAdjKey" value="${data.key}">
                    <input type="hidden" id="modalAdjLoc" value="${data.location}">
                    <input type="hidden" id="modalAdjType" value="${data.type}">
                    <p style="margin-bottom:12px;color:var(--text-light)">Current: <strong>${data.qty} ${data.unit}</strong></p>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Action</label>
                            <select id="modalAdjAction">
                                <option value="add">➕ Add Stock</option>
                                <option value="remove">➖ Remove Stock</option>
                                <option value="set">🔄 Set to Value</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Quantity</label>
                            <input type="number" id="modalAdjQty" min="0" step="0.1" placeholder="Enter quantity">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Reason (optional)</label>
                        <input type="text" id="modalAdjReason" placeholder="e.g., Manual count correction">
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="adjustStockQty()"><i class="fas fa-save"></i> Apply</button>
                    </div>
                `
            };

        case 'addSupplier':
            return {
                title: '➕ Add Supplier',
                html: `
                    <div class="form-group">
                        <label>Supplier Name *</label>
                        <input type="text" id="modalSupName" placeholder="Supplier name" required>
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="tel" id="modalSupPhone" placeholder="Phone number">
                    </div>
                    <div class="form-group">
                        <label>Items Supplied</label>
                        <input type="text" id="modalSupItems" placeholder="e.g., Milk, Sugar (comma separated)">
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <textarea id="modalSupNotes" rows="2" placeholder="Any notes..."></textarea>
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveSupplier()"><i class="fas fa-save"></i> Save</button>
                    </div>
                `
            };

        case 'addPurchase':
            return {
                title: '➕ Add Purchase',
                html: `
                    <div class="form-group">
                        <label>Date *</label>
                        <input type="date" id="modalPurDate" value="${getTodayStr()}">
                    </div>
                    <div class="form-group">
                        <label>Supplier *</label>
                        <select id="modalPurSupplier">
                            <option value="">Select supplier...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Category *</label>
                        <select id="modalPurCategory" onchange="loadPurItemsByCategory(this.value)">
                            <option value="">Select category...</option>
                            <option value="food">Ingredients (Food)</option>
                            <option value="nonfood">Non-Food Items</option>
                            <option value="staff">Staff Store</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Item *</label>
                        <select id="modalPurItem">
                            <option value="">Select item (Select Category First)...</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Quantity *</label>
                            <input type="number" id="modalPurQty" min="0.1" step="0.1" placeholder="Qty" oninput="calcPurTotal()">
                        </div>
                        <div class="form-group">
                            <label>Price per Unit (₹) *</label>
                            <input type="number" id="modalPurPrice" min="0" step="0.5" placeholder="Price" oninput="calcPurTotal()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Total: <strong id="modalPurTotal">₹0</strong></label>
                    </div>
                    <div class="form-group">
                        <label>Location *</label>
                        <select id="modalPurLocation">
                            ${currentRole === ROLES.OWNER ?
                                '<option value="bangalore">Bangalore</option><option value="chennai">Chennai</option>' :
                                '<option value="' + currentLocation + '">' + capitalize(currentLocation) + '</option>'
                            }
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Payment Status</label>
                            <select id="modalPurPayStatus" onchange="document.getElementById('modalPurPaidAmtGroup').style.display=this.value==='partial'?'':'none'">
                                <option value="paid">Paid</option>
                                <option value="pending">Pending</option>
                                <option value="partial">Partial</option>
                            </select>
                        </div>
                        <div class="form-group" id="modalPurPaidAmtGroup" style="display:none">
                            <label>Amount Paid (₹)</label>
                            <input type="number" id="modalPurPaidAmt" min="0" step="0.5">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="modalPurAddToStock" checked> Auto-add to stock
                        </label>
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="savePurchase()"><i class="fas fa-save"></i> Save Purchase</button>
                    </div>
                    <script>loadPurchaseDropdowns();</script>
                `
            };

        case 'addTransfer':
            return {
                title: '🔄 New Stock Transfer',
                html: `
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="modalTrfDate" value="${getTodayStr()}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>From *</label>
                            <select id="modalTrfFrom">
                                <option value="bangalore">Bangalore</option>
                                <option value="chennai">Chennai</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>To *</label>
                            <select id="modalTrfTo">
                                <option value="chennai">Chennai</option>
                                <option value="bangalore">Bangalore</option>
                            </select>
                        </div>
                    </div>
                    <div id="transferItemsContainer">
                        <label>Items to Transfer</label>
                        <div class="transfer-item-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:end">
                            <div style="flex:2">
                                <select class="trf-item-select" style="width:100%">
                                    <option value="">Select item...</option>
                                </select>
                            </div>
                            <div style="flex:1">
                                <input type="number" class="trf-item-qty" placeholder="Qty" min="0.1" step="0.1" style="width:100%">
                            </div>
                        </div>
                    </div>
                    <button class="btn-sm btn-outline" onclick="addTransferItemRow()" style="margin-bottom:16px"><i class="fas fa-plus"></i> Add Item</button>
                    <div class="form-group">
                        <label>Notes</label>
                        <input type="text" id="modalTrfNotes" placeholder="Optional notes">
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveTransfer()"><i class="fas fa-save"></i> Transfer</button>
                    </div>
                    <script>loadTransferItems();</script>
                `
            };

        case 'addProduct':
            return {
                title: (data && data.id) ? '✏️ Edit Product' : '➕ Add Product',
                html: `
                    <input type="hidden" id="modalProdId" value="${(data && data.id) ? data.id : ''}">
                    <div class="form-group">
                        <label>Product Name *</label>
                        <input type="text" id="modalProdName" value="${(data && data.name) ? data.name : ''}" placeholder="e.g., Butterscotch Pudding">
                    </div>
                    <div id="productSizesContainer">
                        <label>Product Sizes *</label>
                        <div id="productSizesList"></div>
                        <button type="button" class="btn-sm btn-outline mt-2" onclick="addProductSizeRow()"><i class="fas fa-plus"></i> Add Size</button>
                    </div>
                    <div class="form-actions mt-12">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveProduct()"><i class="fas fa-save"></i> Save Product</button>
                    </div>
                    <script>
                        window._currentProdSizes = ${JSON.stringify((data && data.sizes) ? data.sizes : null)};
                        if (typeof initProductModalSizes === 'function') initProductModalSizes();
                    </script>
                `
            };

        case 'addDailyStock':
            return {
                title: '➕ Add Daily Inventory',
                html: `
                    <div class="form-group">
                        <label>Date *</label>
                        <input type="date" id="modalDSDate" value="${getTodayStr()}">
                    </div>
                    <div class="form-group">
                        <label>Product *</label>
                        <select id="modalDSProduct" onchange="loadDSProductSizes()">
                            <option value="">Select product...</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Size *</label>
                            <select id="modalDSSize">
                                <option value="">Select size...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Current Quantity *</label>
                            <input type="number" id="modalDSQty" min="0" step="1" placeholder="Quantity">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Location *</label>
                        <select id="modalDSLocation">
                            ${currentRole === ROLES.OWNER ?
                                '<option value="bangalore">Bangalore</option><option value="chennai">Chennai</option>' :
                                '<option value="' + currentLocation + '">' + capitalize(currentLocation) + '</option>'
                            }
                        </select>
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveDailyStock()"><i class="fas fa-save"></i> Save</button>
                    </div>
                    <script>
                        if (typeof loadDSProducts === 'function') loadDSProducts();
                    </script>
                `
            };

        case 'addDailyStockQty':
            return {
                title: '➕ Add Quantity - ' + (data.productName || ''),
                html: `
                    <input type="hidden" id="modalAdjStockId" value="${data.stockId || ''}">
                    <input type="hidden" id="modalAdjProdId" value="${data.productId || ''}">
                    <input type="hidden" id="modalAdjProdName" value="${data.productName || ''}">
                    <input type="hidden" id="modalAdjSize" value="${data.size || ''}">
                    <input type="hidden" id="modalAdjMl" value="${data.ml || ''}">
                    <input type="hidden" id="modalAdjLocation" value="${data.location || ''}">

                    <p style="margin-bottom:12px">Current: <strong>${data.qty || 0}</strong></p>
                    <div class="form-group">
                        <label>Date of Adjustment *</label>
                        <input type="date" id="modalAdjDate" value="${getTodayStr()}">
                    </div>
                    <div class="form-group">
                        <label>Quantity to ADD *</label>
                        <input type="number" id="modalAdjQty" min="1" step="1" placeholder="Enter amount to add">
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="processDailyStockAdjust('add')"><i class="fas fa-plus"></i> Add to Stock</button>
                    </div>
                `
            };

        case 'removeDailyStockQty':
            return {
                title: '➖ Remove / Waste - ' + (data.productName || ''),
                html: `
                    <input type="hidden" id="modalAdjStockId" value="${data.stockId || ''}">
                    <input type="hidden" id="modalAdjProdId" value="${data.productId || ''}">
                    <input type="hidden" id="modalAdjProdName" value="${data.productName || ''}">
                    <input type="hidden" id="modalAdjSize" value="${data.size || ''}">
                    <input type="hidden" id="modalAdjMl" value="${data.ml || ''}">
                    <input type="hidden" id="modalAdjLocation" value="${data.location || ''}">

                    <p style="margin-bottom:12px">Current: <strong>${data.qty || 0}</strong></p>
                    <div class="form-group">
                        <label>Date of Adjustment *</label>
                        <input type="date" id="modalAdjDate" value="${getTodayStr()}">
                    </div>
                    <div class="form-group">
                        <label>Quantity to REMOVE *</label>
                        <input type="number" id="modalAdjQty" min="1" max="${data.qty}" step="1" placeholder="Enter amount to remove">
                    </div>
                    <div class="form-group">
                        <label>Reason for Removal *</label>
                        <select id="modalAdjReason">
                            <option value="spoilage">Spoilage / Expired</option>
                            <option value="damage">Damaged</option>
                            <option value="sample">Free Sample</option>
                            <option value="testing">Internal Testing</option>
                            <option value="theft">Found Missing / Theft</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" id="modalAdjNotes" placeholder="Optional notes about why removed">
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-danger" onclick="processDailyStockAdjust('remove')"><i class="fas fa-trash"></i> Log Removal</button>
                    </div>
                `
            };

        case 'addCustomer':
            return {
                title: '➕ Add Customer',
                html: `
                    <div class="form-group">
                        <label>Customer Name *</label>
                        <input type="text" id="modalCustName" placeholder="Business / Shop name">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Phone *</label>
                            <input type="tel" id="modalCustPhone" placeholder="10-digit mobile">
                        </div>
                        <div class="form-group">
                            <label>Location *</label>
                            <select id="modalCustLocation">
                                ${currentRole === ROLES.OWNER ?
                                    '<option value="bangalore">Bangalore</option><option value="chennai">Chennai</option>' :
                                    '<option value="' + currentLocation + '">' + capitalize(currentLocation) + '</option>'
                                }
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Payment Terms</label>
                        <select id="modalCustPayTerms">
                            <option value="back_to_back">Back to Back (on delivery)</option>
                            <option value="weekly">Weekly</option>
                            <option value="after_next_delivery">After Next Delivery</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Address</label>
                        <textarea id="modalCustAddress" rows="2" placeholder="Delivery address"></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>GST Applicable</label>
                            <label class="toggle-switch">
                                <input type="checkbox" id="modalCustGST" onchange="document.getElementById('modalCustGSTINGroup').style.display=this.checked?'':'none'">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="form-group" id="modalCustGSTINGroup" style="display:none">
                            <label>GSTIN</label>
                            <input type="text" id="modalCustGSTIN" placeholder="GST Number">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <textarea id="modalCustNotes" rows="2" placeholder="Any notes..."></textarea>
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveCustomer()"><i class="fas fa-save"></i> Save</button>
                    </div>
                `
            };

        case 'newOrder':
            return {
                title: '🛒 New Order',
                html: `
                    <div class="form-group">
                        <label>Customer *</label>
                        <select id="modalOrdCustomer" onchange="onOrderCustomerChange()">
                            <option value="">Select customer...</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Invoice No</label>
                            <input type="text" id="modalOrdInvoice" placeholder="Enter invoice number (manual)">
                        </div>
                        <div class="form-group">
                            <label>Order Date</label>
                            <input type="date" id="modalOrdDate" value="${getTodayStr()}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Delivery Date</label>
                        <input type="date" id="modalOrdDeliveryDate" value="${getTodayStr()}">
                    </div>
                    <div id="orderItemsContainer">
                        <label>Products (From Daily Inventory)</label>
                        <div id="orderProductsList">
                            <p class="text-muted">Select a customer first</p>
                        </div>
                    </div>
                    <button type="button" class="btn-sm btn-outline mt-2" onclick="addOrderProductRow()" style="margin-bottom:16px"><i class="fas fa-plus"></i> Add Product</button>
                    ${isOwner() ? '<div class="form-group mt-12"><label>Order Total: <strong id="modalOrdTotal">₹0</strong></label></div>' : ''}
                    <div class="form-group">
                        <label>Notes</label>
                        <input type="text" id="modalOrdNotes" placeholder="Delivery instructions, etc.">
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveOrder()"><i class="fas fa-check"></i> Place Order</button>
                    </div>
                    <script>loadOrderCustomers();</script>
                `
            };

        case 'addExpense':
            return {
                title: '➕ Add Expense',
                html: `
                    <div class="form-group">
                        <label>Date *</label>
                        <input type="date" id="modalExpDate" value="${getTodayStr()}">
                    </div>
                    <div class="form-group">
                        <label>Category *</label>
                        <select id="modalExpCategory">
                            <option value="">Select category...</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Amount (₹) *</label>
                            <input type="number" id="modalExpAmount" min="0" step="0.5" placeholder="Amount">
                        </div>
                        <div class="form-group">
                            <label>Location</label>
                            <select id="modalExpLocation">
                                <option value="bangalore">Bangalore</option>
                                <option value="chennai">Chennai</option>
                                <option value="general">General</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="modalExpDesc" rows="2" placeholder="Details..."></textarea>
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveExpense()"><i class="fas fa-save"></i> Save</button>
                    </div>
                    <script>loadExpenseCategories();</script>
                `
            };

        case 'addStaff':
            return {
                title: '➕ Add Staff Member',
                html: `
                    <div class="form-group">
                        <label>Name *</label>
                        <input type="text" id="modalStaffName" placeholder="Full name">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Phone</label>
                            <input type="tel" id="modalStaffPhone" placeholder="Phone">
                        </div>
                        <div class="form-group">
                            <label>Location *</label>
                            <select id="modalStaffLocation">
                                <option value="bangalore">Bangalore</option>
                                <option value="chennai">Chennai</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Monthly Salary (₹)</label>
                            <input type="number" id="modalStaffSalary" min="0" step="100" placeholder="Salary">
                        </div>
                        <div class="form-group">
                            <label>Role</label>
                            <input type="text" id="modalStaffRole" placeholder="e.g., Cook, Delivery">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Join Date</label>
                        <input type="date" id="modalStaffJoinDate" value="${getTodayStr()}">
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveStaffMember()"><i class="fas fa-save"></i> Save</button>
                    </div>
                `
            };

        case 'recordPayment':
            return {
                title: '💰 Record Payment',
                html: `
                    <input type="hidden" id="modalPayOrderId" value="${data.orderId || ''}">
                    <input type="hidden" id="modalPayCustomerId" value="${data.customerId || ''}">
                    <input type="hidden" id="modalPayMax" value="${data.pendingAmount || 0}">
                    <p style="margin-bottom:8px"><strong>${data.customerName || ''}</strong></p>
                    <p style="margin-bottom:4px;color:var(--text-light)">Invoice: <strong>${data.invoiceNo || 'N/A'}</strong></p>
                    <p style="margin-bottom:16px;color:var(--danger)">Pending: <strong id="modalPayPend">${formatCurrency(data.pendingAmount || 0)}</strong></p>
                    
                    <div class="form-row" style="margin-bottom:8px">
                        <div class="form-group" style="flex:1">
                            <label><i class="fas fa-money-bill-wave"></i> Cash</label>
                            <input type="number" id="payAmtCash" class="pay-input" min="0" step="0.5" value="0" placeholder="0.00" oninput="calcPayTotal()">
                        </div>
                        <div class="form-group" style="flex:1">
                            <label><i class="fab fa-google-pay"></i> UPI</label>
                            <input type="number" id="payAmtUPI" class="pay-input" min="0" step="0.5" value="0" placeholder="0.00" oninput="calcPayTotal()">
                        </div>
                        <div class="form-group" style="flex:1">
                            <label><i class="fas fa-university"></i> Bank</label>
                            <input type="number" id="payAmtBank" class="pay-input" min="0" step="0.5" value="0" placeholder="0.00" oninput="calcPayTotal()">
                        </div>
                    </div>

                    <div style="background:var(--bg-light);padding:12px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between">
                        <div class="text-muted">Total: <strong id="modalPayTotalSum">₹0</strong></div>
                        <div id="modalPayRemaining" class="text-danger">Left: <strong>${formatCurrency(data.pendingAmount || 0)}</strong></div>
                    </div>

                    <div class="form-group">
                        <label>Payment Date</label>
                        <input type="date" id="modalPayDate" value="${getTodayStr()}">
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <input type="text" id="modalPayNotes" placeholder="Transaction ref, etc.">
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button id="btnRecordPay" class="btn-success" onclick="recordPayment()"><i class="fas fa-check"></i> Save Payment</button>
                    </div>
                    <script>
                        window.calcPayTotal = function() {
                            const cashEl = document.getElementById('payAmtCash');
                            const upiEl = document.getElementById('payAmtUPI');
                            const bankEl = document.getElementById('payAmtBank');
                            const max = parseFloat(document.getElementById('modalPayMax').value) || 0;
                            
                            var cashEl = document.getElementById('splitCash');
                            var upiEl = document.getElementById('splitUPI');
                            var bankEl = document.getElementById('splitBank');
                            const cash = parseFloat(cashEl ? cashEl.value : 0) || 0;
                            const upi = parseFloat(upiEl ? upiEl.value : 0) || 0;
                            const bank = parseFloat(bankEl ? bankEl.value : 0) || 0;
                            const total = cash + upi + bank;
                            
                            const totalSumEl = document.getElementById('modalPayTotalSum');
                            const remEl = document.getElementById('modalPayRemaining');
                            const btn = document.getElementById('btnRecordPay');
                            
                            if (totalSumEl) totalSumEl.textContent = formatCurrency(total);
                            const remaining = max - total;
                            
                            if (remEl) {
                                if (total > max + 0.1) {
                                    totalSumEl.style.color = 'var(--danger)';
                                    remEl.innerHTML = 'Excess: <strong>' + formatCurrency(Math.abs(remaining)) + '</strong>';
                                    remEl.className = 'text-danger';
                                    btn.disabled = true;
                                } else {
                                    totalSumEl.style.color = '';
                                    remEl.innerHTML = 'Remaining: <strong>' + formatCurrency(Math.max(0, remaining)) + '</strong>';
                                    remEl.className = remaining <= 0.1 ? 'text-success' : 'text-primary';
                                    btn.disabled = total <= 0;
                                }
                            }
                        };
                        calcPayTotal();
                    </script>
                `
            };

        case 'staffAdvance':
            return {
                title: '💸 Record Advance - ' + (data.name || ''),
                html: `
                    <input type="hidden" id="modalAdvStaffId" value="${data.id || ''}">
                    <div class="form-group">
                        <label>Date *</label>
                        <input type="date" id="modalAdvDate" value="${getTodayStr()}">
                    </div>
                    <div class="form-group">
                        <label>Amount (₹) *</label>
                        <input type="number" id="modalAdvAmount" min="0" step="100" placeholder="Advance amount">
                    </div>
                    <div class="form-group">
                        <label>Reason</label>
                        <input type="text" id="modalAdvReason" placeholder="e.g., Personal need, Festival">
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveAdvance()"><i class="fas fa-save"></i> Save</button>
                    </div>
                `
            };

        case 'customerPricing':
            return {
                title: '💲 Set Prices - ' + (data.name || ''),
                html: `
                    <input type="hidden" id="modalPriceCustomerId" value="${data.id || ''}">
                    <p style="margin-bottom:16px;color:var(--text-light)">Set custom prices for this customer. Leave blank to use default price.</p>
                    <div id="customerPriceList">Loading products...</div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveCustomerPrices()"><i class="fas fa-save"></i> Save Prices</button>
                    </div>
                    <script>loadCustomerPricingForm('${data.id}');</script>
                `
            };

        case 'manageUsers':
            return {
                title: '👥 Manage Staff Logins',
                html: `
                    <div style="margin-bottom:16px;padding:12px;background:var(--info-light);border-radius:8px;font-size:0.85rem;color:var(--info)">
                        <i class="fas fa-info-circle"></i>
                        <strong>How to add staff:</strong><br>
                        1. Go to Firebase Console → Authentication → Add User<br>
                        2. Create email/password for staff<br>
                        3. Copy their UID and add below<br>
                        4. They can then login to the app
                    </div>
                    <h4 style="margin-bottom:8px">Add Staff to Database</h4>
                    <div class="form-group">
                        <label>Firebase UID *</label>
                        <input type="text" id="modalUserUID" placeholder="Paste UID from Firebase Auth">
                    </div>
                    <div class="form-group">
                        <label>Name *</label>
                        <input type="text" id="modalUserName" placeholder="Staff name">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="modalUserEmail" placeholder="Staff email">
                    </div>
                    <div class="form-group">
                        <label>Role *</label>
                        <select id="modalUserRole">
                            <option value="staff_blr">Staff - Bangalore</option>
                            <option value="staff_chn">Staff - Chennai</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button class="btn-outline" onclick="closeModal()">Cancel</button>
                        <button class="btn-primary" onclick="addStaffUser()"><i class="fas fa-save"></i> Add Staff</button>
                    </div>

                    <hr style="margin:20px 0;border-color:var(--border)">
                    <h4 style="margin-bottom:8px">Current Users</h4>
                    <div id="currentUsersList">Loading...</div>
                    <script>loadCurrentUsers();</script>
                `
            };

        case 'confirm':
            return {
                title: data.title || 'Confirm',
                html: `
                    <div style="text-align:center;padding:10px 0 20px">
                        <i class="fas fa-exclamation-triangle" style="font-size:3.5rem;color:#f39c12;margin-bottom:20px;display:block"></i>
                        <p style="font-size:1.1rem;white-space:pre-wrap;color:var(--text-main);line-height:1.6">${data.message || 'Are you sure?'}</p>
                    </div>
                    <div class="form-actions" style="justify-content:center;gap:12px;margin-top:10px">
                        <button class="btn-outline" onclick="handleConfirm(false)" style="flex:1;height:45px">Cancel</button>
                        <button class="btn-danger" onclick="handleConfirm(true)" style="flex:1;height:45px">Yes, Confirm</button>
                    </div>
                `
            };

        default:
            return { title: 'Modal', html: '<p>Content not found</p>' };
    }
}

// ---- Purchase Total Calculator ----
function calcPurTotal() {
    const q = parseFloat(document.getElementById('modalPurQty').value) || 0;
    const p = parseFloat(document.getElementById('modalPurPrice').value) || 0;
    document.getElementById('modalPurTotal').textContent = formatCurrency(q * p);
}

// ---- Staff User Management (Owner Only) ----
async function addStaffUser() {
    const uid = document.getElementById('modalUserUID').value.trim();
    const name = document.getElementById('modalUserName').value.trim();
    const email = document.getElementById('modalUserEmail').value.trim();
    const role = document.getElementById('modalUserRole').value;

    if (!uid || !name) {
        showToast('Please enter UID and Name', 'error');
        return;
    }

    const location = role === 'staff_blr' ? 'bangalore' : 'chennai';

    try {
        await dbRef.users.child(uid).set({
            name: name,
            role: role,
            email: email,
            location: location,
            phone: '',
            approved: true,
            createdAt: Date.now(),
            createdBy: currentUser.uid
        });

        showToast('Staff "' + name + '" added! They can now login.', 'success');
        loadCurrentUsers();
        if (typeof loadSettingsUsersList === 'function') loadSettingsUsersList();
    } catch (e) {
        showToast('Error adding staff: ' + e.message, 'error');
    }
}

async function loadCurrentUsers() {
    const container = document.getElementById('currentUsersList');
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

        container.innerHTML = Object.entries(users).map(function(entry) {
            var uid = entry[0];
            var u = entry[1];
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-light)">' +
                '<div>' +
                    '<strong>' + (u.name || 'Unknown') + '</strong>' +
                    '<br><small class="text-muted">' + (u.email || uid.substring(0, 12) + '...') + '</small>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:8px">' +
                    '<span class="status ' + (u.role === 'owner' ? 'status-ok' : u.role === 'pending' ? 'status-pending' : 'status-placed') + '">' +
                        (roleLabels[u.role] || u.role) +
                    '</span>' +
                    (u.role !== 'owner' ?
                        '<button class="btn-icon danger" onclick="removeStaffUser(\'' + uid + '\',\'' + (u.name || '') + '\')" title="Remove">' +
                            '<i class="fas fa-trash"></i>' +
                        '</button>'
                    : '') +
                '</div>' +
            '</div>';
        }).join('');
    } catch (e) {
        container.innerHTML = '<p class="no-data">Error loading users</p>';
    }
}

async function removeStaffUser(uid, name) {
    var confirmed = await confirmAction('Remove "' + name + '" from the system? They won\'t be able to login anymore.');
    if (!confirmed) return;

    try {
        await dbRef.users.child(uid).remove();
        showToast(name + ' removed', 'success');
        loadCurrentUsers();
        if (typeof loadSettingsUsersList === 'function') loadSettingsUsersList();
    } catch (e) {
        showToast('Error removing user', 'error');
    }
}

// ---- Purchase Item Category Loader ----
window.loadPurItemsByCategory = async function(category) {
    const itemDropdown = document.getElementById('modalPurItem');
    if (!itemDropdown || !category) {
        itemDropdown.innerHTML = '<option value="">Select item...</option>';
        return;
    }

    itemDropdown.innerHTML = '<option value="">Loading items...</option>';
    
    // Items are under dbRef.stock / [location] / [category]
    // Since we need items from both locations or global, we fetch based on active location
    const loc = getActiveLocation();
    const locations = loc === 'all' ? ['bangalore', 'chennai'] : [loc];
    
    let allItems = new Set();
    
    for (const location of locations) {
        const snap = await dbRef.stock.child(`${location}/${category}`).once('value');
        const items = snap.val() || {};
        Object.values(items).forEach(i => allItems.add(i.name));
    }
    
    if (allItems.size === 0) {
        itemDropdown.innerHTML = '<option value="">No items found in this category</option>';
        return;
    }
    
    itemDropdown.innerHTML = '<option value="">Select item...</option>' + 
        Array.from(allItems).sort().map(name => `<option value="${name}">${name}</option>`).join('');
};

// ---- Wastage Tracking ----
window.initWastage = function() {
    console.log('🗑️ Wastage module initialized');
};

window.loadWastage = async function() {
    const tbody = document.getElementById('wastageBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="no-data">Loading logs...</td></tr>';

    try {
        const snap = await dbRef.wastage.once('value');
        const logs = snap.val() || {};

        if (Object.keys(logs).length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No wastage recorded yet</td></tr>';
            return;
        }

        tbody.innerHTML = Object.entries(logs)
            .sort((a, b) => b[1].timestamp - a[1].timestamp)
            .map(([id, log]) => `
                <tr>
                    <td>${new Date(log.timestamp).toLocaleDateString('en-IN')}</td>
                    <td><strong>${log.productName}</strong><br><small>${capitalize(log.size)} (${log.ml}ml)</small></td>
                    <td><strong class="text-danger">${log.qty}</strong></td>
                    <td><span class="status status-critical">${capitalize(log.reason)}</span>${log.notes ? `<br><small>${log.notes}</small>` : ''}</td>
                    <td>${capitalize(log.location)}</td>
                    <td>
                        <div style="display:flex;gap:4px">
                            ${log.cost ? `<span>Cost: ${formatCurrency(log.cost)}</span>` : `
                                <button class="btn-sm btn-outline" onclick="addWastageCost('${id}')">Add Cost</button>
                            `}
                            <button class="btn-icon danger" onclick="deleteWastagePermanent('${id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Error loading wastage data</td></tr>';
    }
};

window.addWastageCost = async function(id) {
    const cost = prompt('Enter the cost (loss) for this item (₹):');
    if (cost === null || cost === '') return;
    
    try {
        await dbRef.wastage.child(id).update({ cost: parseFloat(cost) || 0 });
        showToast('Cost added to logs', 'success');
        loadWastage();
    } catch (e) {
        showToast('Error updating cost', 'error');
    }
};

window.deleteWastagePermanent = async function(id) {
    if (!await confirmAction('Permanently delete this wastage record?')) return;
    await dbRef.wastage.child(id).remove();
    loadWastage();
};

console.log('🎮 App controller loaded');
// ---- Units Management in Settings (Thumbnail Grid) ----
window.loadUnitsSetting = async function() {
    const list = document.getElementById('unitsList');
    if (!list) return;

    dbRef.units.on('value', snap => {
        const units = snap.val() || {};
        if (Object.keys(units).length === 0) {
            list.innerHTML = '<p class="no-data">No custom units added</p>';
            return;
        }

        list.innerHTML = Object.entries(units).map(([id, u]) => `
            <div class="category-card" onclick="editUnitName('${id}', '${u.name}')">
                <i class="fas fa-balance-scale"></i>
                <div class="name">${u.name}</div>
                <button class="delete-btn" onclick="event.stopPropagation(); deleteUnit('${id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    });
};

window.editUnitName = async function(id, currentName) {
    const newName = prompt('Enter new unit name:', currentName);
    if (!newName || newName.trim() === '' || newName === currentName) return;
    
    try {
        await dbRef.units.child(id).update({ name: newName.trim() });
        showToast('Unit renamed', 'success');
    } catch (e) {
        showToast('Error renaming unit', 'error');
    }
};

window.addUnit = async function() {
    const nameInput = document.getElementById('newUnitName');
    const name = nameInput.value.trim();
    if (!name) return;

    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await dbRef.units.child(id).set({ name: name });
    nameInput.value = '';
    showToast('Unit added!', 'success');
};

window.deleteUnit = async function(id) {
    if (!confirm('Delete this unit? Items using it will still show it, but you won\'t be able to select it for new items.')) return;
    await dbRef.units.child(id).remove();
    showToast('Unit deleted', 'info');
};

// Populate units in modals
window.loadModalUnits = function() {
    const dropdowns = document.querySelectorAll('.units-dropdown');
    const units = window.unitsData || {};
    
    dropdowns.forEach(dd => {
        const selected = dd.getAttribute('data-value');
        dd.innerHTML = Object.entries(units).map(([id, u]) => 
            `<option value="${u.name}" ${selected === u.name ? 'selected' : ''}>${u.name}</option>`
        ).join('');
    });
};
