// ============================================
// IR PUDDING TRACKING - PRODUCTS / INVENTORY
// ============================================

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
                        <button class="btn-icon" title="Edit" onclick='editProduct("${id}", ${JSON.stringify(prod)})'>
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

async function saveProduct() {
    const name = document.getElementById('modalProdName').value.trim();
    const small = parseInt(document.getElementById('modalProdSmall').value) || 100;
    const big = parseInt(document.getElementById('modalProdBig').value) || 150;

    if (!name) {
        showToast('Please enter product name', 'error');
        return;
    }

    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    try {
        await dbRef.products.child(key).set({
            name,
            sizes: { small, big },
            active: true,
            createdAt: Date.now()
        });

        closeModal();
        showToast(`${name} added!`, 'success');
        loadProducts();
    } catch (e) {
        showToast('Error saving product', 'error');
    }
}

function editProduct(id, prod) {
    openModal('addProduct');
    setTimeout(() => {
        document.getElementById('modalProdName').value = prod.name || '';
        document.getElementById('modalProdSmall').value = prod.sizes?.small || 100;
        document.getElementById('modalProdBig').value = prod.sizes?.big || 150;

        // Change save button to update
        const modalBody = document.getElementById('modalBody');
        const saveBtn = modalBody.querySelector('.btn-primary');
        if (saveBtn) {
            saveBtn.onclick = async function () {
                const name = document.getElementById('modalProdName').value.trim();
                const small = parseInt(document.getElementById('modalProdSmall').value) || 100;
                const big = parseInt(document.getElementById('modalProdBig').value) || 150;

                if (!name) { showToast('Enter product name', 'error'); return; }

                try {
                    await dbRef.products.child(id).update({ name, sizes: { small, big } });
                    closeModal();
                    showToast('Product updated!', 'success');
                    loadProducts();
                } catch (e) { showToast('Error updating', 'error'); }
            };
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Update';
        }
        document.getElementById('modalTitle').textContent = '✏️ Edit Product';
    }, 100);
}

async function deleteProduct(id, name) {
    const confirmed = await confirmAction(`Delete "${name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
        await dbRef.products.child(id).remove();
        await dbRef.recipes.child(id).remove();
        showToast(`${name} deleted`, 'success');
        loadProducts();
    } catch (e) {
        showToast('Error deleting product', 'error');
    }
}

async function editRecipe(productId, productName) {
    // Load current recipe and all stock items
    try {
        const [recipeSnap, stockSnap] = await Promise.all([
            dbRef.recipes.child(productId).once('value'),
            dbRef.stock.child('bangalore/food').once('value')
        ]);

        const recipe = recipeSnap.val() || {};
        const foodItems = stockSnap.val() || {};

        const title = `🧪 Recipe - ${productName}`;
        const itemRows = Object.entries(foodItems).map(([key, item]) => `
            <div class="form-row" style="margin-bottom:8px">
                <div class="form-group" style="flex:2;margin-bottom:0">
                    <label style="font-size:0.8rem">${item.name} (${item.unit})</label>
                </div>
                <div class="form-group" style="flex:1;margin-bottom:0">
                    <input type="number" class="recipe-input" data-ingredient="${key}"
                           value="${recipe[key]?.qty_per_480 || ''}"
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
