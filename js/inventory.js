// ============================================
// IR PUDDING TRACKING - PRODUCTS / INVENTORY
// ============================================

// Global store for daily stock items (avoids JSON in onclick)
window._dailyStockItems = {};

function initProducts() {
    console.log('🍨 Products module loaded');
}

async function loadProducts() {
    const container = document.getElementById('productsGrid');
    if (!container) return;

    container.innerHTML = '<p class="no-data">Loading products...</p>';

    try {
        const snap = await dbRef.products.once('value');
        const products = snap.val() || {};

        if (Object.keys(products).length === 0) {
            container.innerHTML = '<p class="no-data">No products yet. Click "Add Product" to start.</p>';
            return;
        }

        // Load recipes
        const recipeSnap = await dbRef.recipes.once('value');
        const recipes = recipeSnap.val() || {};

        container.innerHTML = Object.entries(products).map(([id, prod]) => {
            const hasRecipe = recipes[id] && Object.keys(recipes[id]).length > 0;

            return `
                <div class="product-card">
                    <h3><i class="fas fa-ice-cream"></i> ${prod.name}</h3>
                    <div class="product-sizes">
                        ${prod.sizes ? Object.entries(prod.sizes).map(([size, ml]) =>
                            `<span class="size-tag">${capitalize(size)}: ${ml}ml</span>`
                        ).join('') : '<span class="size-tag">Standard</span>'}
                    </div>
                    <div style="margin-top:8px">
                        <span class="status ${hasRecipe ? 'status-ok' : 'status-pending'}">
                            ${hasRecipe ? '✅ Recipe set' : '⚠️ No recipe'}
                        </span>
                        <span class="status ${prod.active !== false ? 'status-ok' : 'status-critical'}">
                            ${prod.active !== false ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="actions">
                        ${isOwner() ? `
                            <button class="btn-sm btn-outline" onclick="editRecipe('${id}','${prod.name}')">
                                <i class="fas fa-flask"></i> Recipe
                            </button>
                        ` : ''}
                        <button class="btn-icon" title="Edit" onclick="editProduct('${id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" title="Delete" onclick="deleteProduct('${id}','${prod.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p class="no-data">Error loading products</p>';
        console.error('Products error:', e);
    }
}

// Store products globally for edit reference
window._productsCache = {};

async function saveProduct() {
    const id = document.getElementById('modalProdId').value;
    const name = document.getElementById('modalProdName').value.trim();
    
    // Gather sizes
    const sizeRows = document.querySelectorAll('.prod-size-row');
    const sizes = {};
    
    sizeRows.forEach(row => {
        const label = row.querySelector('.size-label').value.trim();
        const ml = parseInt(row.querySelector('.size-ml').value) || 0;
        if (label && ml > 0) {
            sizes[label.toLowerCase()] = ml;
        }
    });

    if (!name || Object.keys(sizes).length === 0) {
        showToast('Please enter name and at least one size', 'error');
        return;
    }

    const key = id || name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    try {
        await dbRef.products.child(key).update({
            name,
            sizes,
            active: true,
            updatedAt: Date.now()
        });

        closeModal();
        showToast('Product saved!', 'success');
        loadProducts();
    } catch (e) {
        showToast('Error saving product', 'error');
    }
}

async function editProduct(id) {
    try {
        const snap = await dbRef.products.child(id).once('value');
        const prod = snap.val();
        if (!prod) { showToast('Product not found', 'error'); return; }
        prod.id = id;
        openModal('addProduct', prod);
    } catch (e) {
        showToast('Error loading product', 'error');
    }
}

// ---- Dynamic Size UI Helpers ----
window.initProductModalSizes = function() {
    const container = document.getElementById('productSizesList');
    if (!container) return;

    if (window._currentProdSizes) {
        Object.entries(window._currentProdSizes).forEach(([label, ml]) => {
            addProductSizeRow(label, ml);
        });
    } else {
        // Defaults
        addProductSizeRow('small', 100);
        addProductSizeRow('big', 150);
    }
};

window.addProductSizeRow = function(label = '', ml = '') {
    const container = document.getElementById('productSizesList');
    const rowId = generateId();
    const row = document.createElement('div');
    row.className = 'form-row prod-size-row';
    row.style.marginBottom = '8px';
    row.id = `size_row_${rowId}`;
    row.innerHTML = `
        <div class="form-group" style="flex:2">
            <input type="text" class="size-label" placeholder="e.g., Small" value="${label}">
        </div>
        <div class="form-group" style="flex:1">
            <input type="number" class="size-ml" placeholder="ml" value="${ml}">
        </div>
        <div style="flex:0">
            <button type="button" class="btn-icon danger" style="margin-top:24px" onclick="removeProductSizeRow('${rowId}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    container.appendChild(row);
};

window.removeProductSizeRow = function(id) {
    const row = document.getElementById(`size_row_${id}`);
    if (row) row.remove();
};

async function deleteProduct(id, name) {
    const confirmed = await confirmAction('Delete "' + name + '"? This cannot be undone.');
    if (!confirmed) return;

    try {
        await dbRef.products.child(id).remove();
        await dbRef.recipes.child(id).remove();
        showToast(name + ' deleted', 'success');
        loadProducts();
    } catch (e) {
        showToast('Error deleting product', 'error');
    }
}

async function editRecipe(productId, productName) {
    try {
        const [recipeSnap, stockSnap] = await Promise.all([
            dbRef.recipes.child(productId).once('value'),
            dbRef.stock.child('bangalore/food').once('value')
        ]);

        const recipe = recipeSnap.val() || {};
        const foodItems = stockSnap.val() || {};

        const title = '🧪 Recipe - ' + productName;
        const itemRows = Object.entries(foodItems).map(([key, item]) => `
            <div class="form-row" style="margin-bottom:8px">
                <div class="form-group" style="flex:2;margin-bottom:0">
                    <label style="font-size:0.8rem">${item.name} (${item.unit})</label>
                </div>
                <div class="form-group" style="flex:1;margin-bottom:0">
                    <input type="number" class="recipe-input" data-ingredient="${key}"
                           value="${(recipe[key] && recipe[key].qty_per_480) ? recipe[key].qty_per_480 : ''}"
                           placeholder="for 480 pcs" min="0" step="0.01">
                </div>
            </div>
        `).join('');

        const overlay = document.getElementById('modalOverlay');
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = `
            <p style="margin-bottom:16px;color:var(--text-light)">
                Enter ingredient quantity needed for <strong>480 pieces</strong>.<br>
                Per-piece usage will be auto-calculated.
            </p>
            ${itemRows}
            <div class="form-actions">
                <button class="btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn-primary" onclick="saveRecipe('${productId}')"><i class="fas fa-save"></i> Save Recipe</button>
            </div>
        `;
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    } catch (e) {
        showToast('Error loading recipe', 'error');
    }
}

async function saveRecipe(productId) {
    const inputs = document.querySelectorAll('.recipe-input');
    const recipe = {};

    inputs.forEach(input => {
        const ingredient = input.dataset.ingredient;
        const qty = parseFloat(input.value) || 0;
        if (qty > 0) {
            recipe[ingredient] = {
                qty_per_480: qty,
                qty_per_piece: qty / 480
            };
        }
    });

    try {
        await dbRef.recipes.child(productId).set(recipe);
        closeModal();
        showToast('Recipe saved! Per-piece calculations updated.', 'success');
        loadProducts();
    } catch (e) {
        showToast('Error saving recipe', 'error');
    }
}

console.log('🍨 Products module loaded');

// Missing functions restored
async function loadDSProducts() {
    const select = document.getElementById('modalDSProduct');
    if (!select) return;
    try {
        const snap = await dbRef.products.once('value');
        const prods = snap.val() || {};
        select.innerHTML = '<option value="">Select product...</option>';
        Object.entries(prods).forEach(([id, p]) => {
            if (p.active !== false) {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = p.name;
                select.appendChild(opt);
            }
        });
    } catch(e) {}
}

async function loadDSProductSizes() {
    const prodId = document.getElementById('modalDSProduct').value;
    const select = document.getElementById('modalDSSize');
    if (!prodId || !select) return;
    try {
        const snap = await dbRef.products.child(prodId).once('value');
        const p = snap.val() || {};
        select.innerHTML = '<option value="">Select size...</option>';
        if (p.sizes) {
            Object.entries(p.sizes).forEach(([size, ml]) => {
                const opt = document.createElement('option');
                opt.value = size;
                opt.dataset.ml = ml;
                opt.textContent = capitalize(size) + ' (' + ml + 'ml)';
                select.appendChild(opt);
            });
        }
    } catch(e) {}
}

// ============================================
// DAILY INVENTORY (Finished Stock)
// ============================================

// Helper: Open daily stock modal using stored data (avoids JSON in HTML attributes)
window.openDailyStockModal = function(type, stockId) {
    console.log('openDailyStockModal called:', type, stockId);
    console.log('Available items:', Object.keys(window._dailyStockItems || {}).length);
    
    var item = window._dailyStockItems ? window._dailyStockItems[stockId] : null;
    if (!item) {
        console.error('Item not found for stockId:', stockId);
        console.error('Available stockIds:', Object.keys(window._dailyStockItems || {}));
        showToast('Item data not found. Please refresh the page.', 'error');
        return;
    }
    console.log('Opening modal with data:', JSON.stringify(item));
    openModal(type, item);
};

async function loadDailyStock() {
    const tableBody = document.getElementById('dailyStockBody');
    const tableContainer = document.getElementById('dailyStockContainer');
    const gridContainer = document.getElementById('dailyStockGrid');
    
    if (!tableBody) return;

    console.log('🔄 Loading daily stock...');
    var loc = getActiveLocation();
    var locations = loc === 'all' ? ['bangalore', 'chennai'] : [loc];
    
    tableBody.innerHTML = '<tr><td colspan="4" class="no-data">Loading inventory...</td></tr>';
    if (gridContainer) gridContainer.innerHTML = '<p class="no-data">Loading inventory...</p>';

    try {
        var prodSnap = await dbRef.products.once('value');
        var stockRefObj = dbRef.dailyStock ? dbRef.dailyStock : firebase.database().ref('dailyStock');
        var stockSnap = await stockRefObj.once('value');
        
        console.log('📦 Daily stock data received');
        var allProducts = prodSnap.val() || {};
        var dailyStock = stockSnap.val() || {};
        
        var sortingOrder = [
            'tender coconut', 'mango', 'custard apple', 'mysore pak', 'caramel'
        ];

        function getRank(name) {
            if (!name || typeof name !== 'string') return 999;
            var n = name.toLowerCase();
            for(var i=0; i<sortingOrder.length; i++) {
                if (n.includes(sortingOrder[i])) return i;
            }
            return 999;
        }

        var fullList = [];
        // Clear the global store
        window._dailyStockItems = {};

        Object.entries(allProducts).forEach(([prodId, prod]) => {
            if (prod.active === false) return;
            var sizes = prod.sizes || { standard: 0 };
            
            locations.forEach(function(location) {
                Object.entries(sizes).forEach(([sizeLabel, ml]) => {
                    var stockId = prodId + '_' + sizeLabel + '_' + location;
                    var currentStock = dailyStock[stockId] || null;
                    
                    var item = {
                        stockId: stockId,
                        productId: prodId,
                        productName: prod.name,
                        size: sizeLabel,
                        ml: ml,
                        qty: currentStock ? (currentStock.qty || 0) : 0,
                        location: location,
                        updatedAt: currentStock ? (currentStock.updatedAt || 0) : 0
                    };

                    fullList.push(item);
                    // Store in global map for onclick reference
                    window._dailyStockItems[stockId] = item;
                });
            });
        });

        console.log('Daily stock items stored:', Object.keys(window._dailyStockItems).length);
        
        fullList.sort(function(a, b) {
            var rankA = getRank(a.productName || '');
            var rankB = getRank(b.productName || '');
            if (rankA !== rankB) return rankA - rankB;
            var nameComp = (a.productName || '').localeCompare(b.productName || '');
            if (nameComp !== 0) return nameComp;
            return (parseInt(a.ml) || 0) - (parseInt(b.ml) || 0);
        });

        console.log('📋 Rendering', fullList.length, 'items');

        // Render table rows (Laptop)
        tableBody.innerHTML = fullList.map(function(s) {
            try {
                return '<tr>' +
                    '<td data-label="Product">' +
                        '<strong>' + (s.productName || 'Unknown') + '</strong>' +
                        '<br><small class="text-muted"><i class="fas fa-map-marker-alt"></i> ' + capitalize(s.location || '') + '</small>' +
                    '</td>' +
                    '<td data-label="Size"><span class="size-tag">' + capitalize(s.size || '') + ' (' + (s.ml || 0) + 'ml)</span></td>' +
                    '<td data-label="Qty"><strong class="' + (s.qty === 0 ? 'text-muted' : '') + '">' + (s.qty || 0) + '</strong></td>' +
                    '<td data-label="Actions">' +
                        '<div style="display:flex;gap:4px;justify-content:flex-end;width:100%">' +
                            '<button class="btn-icon" title="Add Quantity" onclick="openDailyStockModal(\'addDailyStockQty\',\'' + s.stockId + '\')">' +
                                '<i class="fas fa-plus-circle"></i>' +
                            '</button>' +
                            '<button class="btn-icon danger" title="Remove / Waste" onclick="openDailyStockModal(\'removeDailyStockQty\',\'' + s.stockId + '\')">' +
                                '<i class="fas fa-minus-circle"></i>' +
                            '</button>' +
                        '</div>' +
                    '</td>' +
                '</tr>';
            } catch(err) { return ''; }
        }).join('') || '<tr><td colspan="4" class="no-data">No items found</td></tr>';

        // Render card grid (Mobile - Staff Style)
        if (gridContainer) {
            gridContainer.innerHTML = fullList.map(function(s) {
                try {
                    return '<div class="staff-card">' +
                        '<div class="staff-card-header">' +
                            '<div class="staff-avatar" style="background:var(--primary-light); color:var(--primary)">' + (s.productName || 'P').charAt(0).toUpperCase() + '</div>' +
                            '<div>' +
                                '<h3>' + (s.productName || 'Unknown') + '</h3>' +
                                '<small><i class="fas fa-map-marker-alt"></i> ' + capitalize(s.location || '') + '</small>' +
                            '</div>' +
                        '</div>' +
                        '<div class="staff-details">' +
                            '<div><span>Size:</span> <strong>' + capitalize(s.size || '') + ' (' + (s.ml || 0) + 'ml)</strong></div>' +
                            '<div><span>Quantity:</span> <strong style="font-size:1.1rem; color:var(--primary)">' + (s.qty || 0) + '</strong></div>' +
                        '</div>' +
                        '<div class="actions" style="margin-top:12px; gap:8px">' +
                            '<button class="btn-sm btn-outline" style="flex:1" onclick="openDailyStockModal(\'addDailyStockQty\',\'' + s.stockId + '\')"><i class="fas fa-plus"></i> Add</button>' +
                            '<button class="btn-sm btn-outline danger" style="flex:1" onclick="openDailyStockModal(\'removeDailyStockQty\',\'' + s.stockId + '\')"><i class="fas fa-minus"></i> Waste</button>' +
                        '</div>' +
                    '</div>';
                } catch(e) { return ''; }
            }).join('') || '<p class="no-data">No items found</p>';
        }

        console.log('✅ Daily stock rendered');
    } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="4" class="no-data">Error loading daily stock</td></tr>';
        console.error('❌ Daily Stock Error:', e);
    }
}

async function processDailyStockAdjust(action) {
    var stockId = document.getElementById('modalAdjStockId').value;
    var adjQty = parseInt(document.getElementById('modalAdjQty').value) || 0;
    var adjDate = document.getElementById('modalAdjDate').value || getTodayStr();
    
    if (adjQty <= 0) {
        showToast('Please enter a valid quantity', 'error');
        return;
    }

    var stockRef = dbRef.dailyStock ? dbRef.dailyStock.child(stockId) : firebase.database().ref('dailyStock').child(stockId);

    try {
        var snap = await stockRef.once('value');
        var currentData = snap.val() || {};
        var currentQty = currentData.qty || 0;

        var newQty = currentQty;
        var ledgerAction = '';

        if (action === 'add') {
            newQty = currentQty + adjQty;
            ledgerAction = 'Added Stock';
            
            await stockRef.update({
                qty: newQty,
                updatedAt: Date.now(),
                updatedBy: currentUser.uid
            });
            
            // Log to Inventory Ledger
            var ledgerId = generateId();
            await dbRef.inventoryLedger.child(ledgerId).set({
                productId: currentData.productId || (document.getElementById('modalAdjProdId') ? document.getElementById('modalAdjProdId').value : ''),
                productName: currentData.productName || (document.getElementById('modalAdjProdName') ? document.getElementById('modalAdjProdName').value : ''),
                size: currentData.size || (document.getElementById('modalAdjSize') ? document.getElementById('modalAdjSize').value : ''),
                action: ledgerAction,
                qty: adjQty,
                location: currentData.location || (document.getElementById('modalAdjLocation') ? document.getElementById('modalAdjLocation').value : ''),
                date: adjDate,
                timestamp: Date.now(),
                by: currentUser.name
            });

            showToast('Added ' + adjQty + ' to stock', 'success');
        } else {
            var reason = document.getElementById('modalAdjReason').value;
            var notes = document.getElementById('modalAdjNotes').value;
            newQty = Math.max(0, currentQty - adjQty);
            ledgerAction = 'Removed (' + reason + ')';

            // Update Inventory
            await stockRef.update({
                qty: newQty,
                updatedAt: Date.now(),
                updatedBy: currentUser.uid
            });

            // Log to Wastage
            var wastageId = generateId();
            await dbRef.wastage.child(wastageId).set({
                productId: document.getElementById('modalAdjProdId').value,
                productName: document.getElementById('modalAdjProdName').value,
                size: document.getElementById('modalAdjSize').value,
                ml: document.getElementById('modalAdjMl').value,
                location: document.getElementById('modalAdjLocation').value,
                qty: adjQty,
                reason: reason,
                notes: notes,
                timestamp: Date.now(),
                date: adjDate,
                loggedBy: currentUser.uid
            });

            showToast('Removed ' + adjQty + ' and logged as wastage', 'info');
        }

        closeModal();
        loadDailyStock();
        if (typeof loadWastage === 'function') loadWastage();
        if (typeof loadInventoryLedger === 'function') loadInventoryLedger();
    } catch (e) {
        showToast('Error adjusting stock', 'error');
        console.error(e);
    }
}

async function saveDailyStock() {
    var prodSelect = document.getElementById('modalDSProduct');
    var sizeSelect = document.getElementById('modalDSSize');
    var adjDate = document.getElementById('modalDSDate').value || getTodayStr();

    var productId = prodSelect.value;
    var productOpt = prodSelect.options[prodSelect.selectedIndex];
    var productName = productOpt ? productOpt.textContent : '';
    var size = sizeSelect.value;
    var sizeOpt = sizeSelect.options[sizeSelect.selectedIndex];
    var ml = (sizeOpt && sizeOpt.dataset) ? sizeOpt.dataset.ml : 0;
    var qty = parseInt(document.getElementById('modalDSQty').value) || 0;
    var location = document.getElementById('modalDSLocation').value;
    
    if (!productId || !size) {
        showToast('Please select a product and size', 'error');
        return;
    }
    
    var stockId = productId + '_' + size + '_' + location;
    
    try {
        var stockRef = dbRef.dailyStock ? dbRef.dailyStock.child(stockId) : firebase.database().ref('dailyStock').child(stockId);
        await stockRef.update({
            productId: productId,
            productName: productName,
            size: size,
            ml: parseInt(ml),
            qty: qty,
            location: location,
            updatedAt: Date.now(),
            updatedBy: currentUser.uid
        });

        // Log to Ledger
        var ledgerId = generateId();
        await dbRef.inventoryLedger.child(ledgerId).set({
            productId: productId,
            productName: productName,
            size: size,
            action: 'Manual Initial/Reset',
            qty: qty,
            location: location,
            date: adjDate,
            timestamp: Date.now(),
            by: currentUser.name
        });
        
        closeModal();
        showToast('Daily inventory updated!', 'success');
        loadDailyStock();
        if (typeof loadInventoryLedger === 'function') loadInventoryLedger();
    } catch (e) {
        showToast('Error saving inventory', 'error');
        console.error(e);
    }
}

async function loadInventoryLedger() {
    var body = document.getElementById('inventoryLedgerBody');
    if (!body) return;

    var filterLoc = document.getElementById('invLedgerLocation').value;
    var dateFromEl = document.getElementById('invLedgerDate');
    var dateToEl = document.getElementById('invLedgerDateTo');
    
    var dateFrom = dateFromEl.value;
    var dateTo = dateToEl.style.display !== 'none' ? dateToEl.value : dateFrom;

    try {
        var snap = await dbRef.inventoryLedger.once('value');
        var logs = snap.val() || {};

        var filtered = Object.values(logs)
            .filter(function(l) {
                var locMatch = filterLoc === 'all' || l.location === filterLoc;
                var dateMatch = true;
                if (dateToEl.style.display === 'none') {
                    dateMatch = !dateFrom || l.date === dateFrom;
                } else {
                    dateMatch = (!dateFrom || l.date >= dateFrom) && (!dateTo || l.date <= dateTo);
                }
                return locMatch && dateMatch;
            })
            .sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

        if (filtered.length === 0) {
            body.innerHTML = '<tr><td colspan="7" class="no-data">No logs found for selected filters</td></tr>';
            return;
        }

        body.innerHTML = filtered.map(function(l) {
            var rowId = Object.keys(logs).find(function(key) { return logs[key].timestamp === l.timestamp && logs[key].productId === l.productId; });
            return '<tr>' +
                '<td data-label="Date">' + l.date + '<br><small class="text-light">' + new Date(l.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + '</small></td>' +
                '<td data-label="Product"><strong>' + l.productName + '</strong><br><small>' + capitalize(l.size) + '</small></td>' +
                '<td data-label="Action"><span class="status ' + (l.action.includes('Removed') ? 'status-critical' : 'status-ok') + '">' + l.action + '</span></td>' +
                '<td data-label="Qty">' + l.qty + '</td>' +
                '<td data-label="Location">' + capitalize(l.location) + '</td>' +
                '<td data-label="By">' + (l.by || 'System') + '</td>' +
                '<td data-label="Actions">' +
                    (isOwner() ?
                        '<div style="display:flex;gap:4px;justify-content:flex-end;width:100%">' +
                            '<button class="btn-icon danger" onclick="deleteInventoryLedgerEntry(\'' + rowId + '\')" title="Delete"><i class="fas fa-trash"></i></button>' +
                        '</div>'
                    : '-') +
                '</td>' +
            '</tr>';
        }).join('');
        
        // Store for export
        window.lastLedgerData = filtered;
        
    } catch (e) {
        body.innerHTML = '<tr><td colspan="7" class="no-data">Error loading ledger</td></tr>';
    }
}

async function deleteInventoryLedgerEntry(ledgerId) {
    if (!isOwner()) return;
    
    var confirmDelete = await confirmAction('Are you sure you want to PERMANENTLY delete this ledger record? This cannot be undone.');
    if (!confirmDelete) return;

    try {
        await dbRef.inventoryLedger.child(ledgerId).remove();
        showToast('Ledger entry deleted permanently', 'success');
        loadInventoryLedger();
    } catch (e) {
        showToast('Error deleting record', 'error');
    }
}

window.switchLedgerRange = function(range, btn) {
    document.querySelectorAll('.ledger-tab').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');

    var dateFrom = document.getElementById('invLedgerDate');
    var dateTo = document.getElementById('invLedgerDateTo');
    var today = getTodayStr();

    dateFrom.style.display = '';
    dateTo.style.display = 'none';

    if (range === 'daily') {
        dateFrom.value = today;
    } else if (range === 'weekly') {
        var d = new Date();
        d.setDate(d.getDate() - 7);
        dateFrom.value = d.toISOString().split('T')[0];
        dateTo.style.display = '';
        dateTo.value = today;
    } else if (range === 'monthly') {
        var d2 = new Date();
        d2.setMonth(d2.getMonth() - 1);
        dateFrom.value = d2.toISOString().split('T')[0];
        dateTo.style.display = '';
        dateTo.value = today;
    } else if (range === 'custom') {
        dateTo.style.display = '';
    }

    loadInventoryLedger();
};

window.exportInventoryLedger = function() {
    if (!window.lastLedgerData || window.lastLedgerData.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    var rows = window.lastLedgerData.map(function(l) {
        return {
            'Date': l.date,
            'Time': new Date(l.timestamp).toLocaleTimeString(),
            'Product': l.productName,
            'Size': l.size,
            'Action': l.action,
            'Qty': l.qty,
            'Location': l.location,
            'Logged By': l.by
        };
    });

    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory_Ledger');
    XLSX.writeFile(wb, 'Inventory_Ledger_' + getTodayStr() + '.xlsx');
    showToast('Ledger exported!', 'success');
};
