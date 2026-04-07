// ============================================
// IR PUDDING TRACKING - EXPENSES
// ============================================

function initExpenses() {
    console.log('🧾 Expenses module loaded');
}

async function loadExpenses() {
    if (!isOwner()) return;

    const tbody = document.getElementById('expensesBody');
    if (!tbody) return;

    const loc = getActiveLocation();
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">Loading...</td></tr>';

    try {
        const snap = await dbRef.expenses.once('value');
        const expenses = snap.val() || {};

        let filtered = Object.entries(expenses)
            .map(([id, e]) => ({ id, ...e }))
            .filter(e => loc === 'all' || e.location === loc || e.location === 'general')
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No expenses yet</td></tr>';
            document.getElementById('expenseTotal').textContent = '₹0';
            return;
        }

        let total = 0;
        filtered.forEach(e => total += parseFloat(e.amount) || 0);
        document.getElementById('expenseTotal').textContent = formatCurrency(total);

        tbody.innerHTML = filtered.map(e => `
            <tr>
                <td>${formatDate(e.date)}</td>
                <td><span class="status status-placed">${e.categoryName || e.category || '-'}</span></td>
                <td>${e.description || '-'}</td>
                <td><strong>${formatCurrency(e.amount)}</strong></td>
                <td>${capitalize(e.location || '-')}</td>
                <td>
                    <button class="btn-icon danger" onclick="deleteExpense('${e.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">Error loading expenses</td></tr>';
    }
}

async function loadExpenseCategories() {
    const select = document.getElementById('modalExpCategory');
    if (!select) return;

    try {
        const snap = await dbRef.expenseCategories.once('value');
        const categories = snap.val() || {};

        select.innerHTML = '<option value="">Select category...</option>';
        Object.entries(categories).forEach(([key, cat]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });
    } catch (e) { /* ignore */ }
}

async function saveExpense() {
    const date = document.getElementById('modalExpDate').value;
    const categorySelect = document.getElementById('modalExpCategory');
    const category = categorySelect.value;
    const categoryName = categorySelect.options[categorySelect.selectedIndex]?.textContent || '';
    const amount = parseFloat(document.getElementById('modalExpAmount').value) || 0;
    const location = document.getElementById('modalExpLocation').value;
    const description = document.getElementById('modalExpDesc').value.trim();

    if (!date || !category || amount <= 0) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        const id = generateId();
        await dbRef.expenses.child(id).set({
            date, category, categoryName, amount, location, description,
            createdBy: currentUser.uid,
            createdAt: Date.now()
        });

        closeModal();
        showToast('Expense recorded!', 'success');
        loadExpenses();
    } catch (e) {
        showToast('Error saving expense', 'error');
    }
}

async function deleteExpense(id) {
    const confirmed = await confirmAction('Delete this expense?');
    if (!confirmed) return;

    try {
        await dbRef.expenses.child(id).remove();
        showToast('Expense deleted', 'success');
        loadExpenses();
    } catch (e) {
        showToast('Error deleting expense', 'error');
    }
}

function filterExpenses() {
    const rows = document.querySelectorAll('#expensesBody tr');
    const catFilter = document.getElementById('expenseCategoryFilter').value.toLowerCase();

    rows.forEach(row => {
        if (row.querySelector('.no-data')) return;
        const catCell = row.querySelectorAll('td')[1]?.textContent?.toLowerCase() || '';
        let show = true;
        if (catFilter && !catCell.includes(catFilter.replace('_', ' '))) show = false;
        row.style.display = show ? '' : 'none';
    });
}

async function exportExpenses() {
    const rows = document.querySelectorAll('#expensesBody tr');
    const data = [];

    rows.forEach(row => {
        if (row.querySelector('.no-data') || row.style.display === 'none') return;
        const cells = row.querySelectorAll('td');
        data.push({
            Date: cells[0]?.textContent || '',
            Category: cells[1]?.textContent?.trim() || '',
            Description: cells[2]?.textContent || '',
            Amount: cells[3]?.textContent || '',
            Location: cells[4]?.textContent || ''
        });
    });

    exportToExcel(data, 'IR_Pudding_Expenses', 'Expenses');
}

console.log('🧾 Expenses module loaded');
