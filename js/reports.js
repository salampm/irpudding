// ============================================
// IR PUDDING TRACKING - REPORTS
// ============================================

let currentReportType = 'daily';

function initReports() {
    // Set default dates
    document.getElementById('reportDateFrom').value = getTodayStr();
    document.getElementById('reportDateTo').value = getTodayStr();
    console.log('📈 Reports module loaded');
}

function showReport(type, btn) {
    currentReportType = type;
    document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const fromInput = document.getElementById('reportDateFrom');
    const toInput = document.getElementById('reportDateTo');

    const today = new Date();

    switch (type) {
        case 'daily':
            fromInput.value = getTodayStr();
            toInput.value = getTodayStr();
            break;
        case 'weekly':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            fromInput.value = weekAgo.toISOString().split('T')[0];
            toInput.value = getTodayStr();
            break;
        case 'monthly':
            fromInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            toInput.value = getTodayStr();
            break;
        case 'custom':
            // Keep current values
            break;
    }
}

async function generateReport() {
    if (!isOwner()) return;

    const content = document.getElementById('reportContent');
    const loc = getActiveLocation();
    const dateFrom = document.getElementById('reportDateFrom').value;
    const dateTo = document.getElementById('reportDateTo').value;

    content.innerHTML = '<p class="no-data">Generating report...</p>';

    try {
        const [ordersSnap, expSnap, paySnap] = await Promise.all([
            dbRef.orders.once('value'),
            dbRef.expenses.once('value'),
            dbRef.payments.once('value')
        ]);

        const orders = ordersSnap.val() || {};
        const expenses = expSnap.val() || {};
        const payments = paySnap.val() || {};

        // Filter by date and location
        let filteredOrders = Object.values(orders).filter(o =>
            (loc === 'all' || o.location === loc) &&
            o.date >= dateFrom && o.date <= dateTo
        );

        let filteredExpenses = Object.values(expenses).filter(e =>
            (loc === 'all' || e.location === loc || e.location === 'general') &&
            e.date >= dateFrom && e.date <= dateTo
        );

        let filteredPayments = Object.values(payments).filter(p => {
            const dateMatch = p.date >= dateFrom && p.date <= dateTo;
            if (!dateMatch) return false;
            // Filter by location of original order
            if (loc === 'all') return true;
            const order = orders[p.orderId];
            return order && order.location === loc;
        });

        // Calculate totals
        const totalSales = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const totalCollections = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const totalOrders = filteredOrders.length;
        const deliveredOrders = filteredOrders.filter(o => o.status === 'delivered').length;
        const profit = totalSales - totalExpenses;

        // Expense breakdown
        const expenseByCategory = {};
        filteredExpenses.forEach(e => {
            const cat = e.categoryName || e.category || 'Other';
            expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (parseFloat(e.amount) || 0);
        });

        // Product breakdown
        const productSales = {};
        filteredOrders.forEach(o => {
            (o.items || []).forEach(item => {
                const key = item.productName || item.productId;
                if (!productSales[key]) productSales[key] = { qty: 0, revenue: 0 };
                productSales[key].qty += parseInt(item.qty) || 0;
                productSales[key].revenue += parseFloat(item.lineTotal) || 0;
            });
        });

        // Customer breakdown
        const customerSales = {};
        filteredOrders.forEach(o => {
            const key = o.customerName || o.customerId;
            if (!customerSales[key]) customerSales[key] = { orders: 0, revenue: 0 };
            customerSales[key].orders++;
            customerSales[key].revenue += parseFloat(o.total) || 0;
        });

        content.innerHTML = `
            <div style="margin-bottom:24px">
                <h2 style="font-size:1.2rem;margin-bottom:4px">
                    ${currentReportType === 'daily' ? 'Daily' : currentReportType === 'weekly' ? 'Weekly' : currentReportType === 'monthly' ? 'Monthly' : 'Custom'} Report
                </h2>
                <p class="text-muted">${formatDate(dateFrom)} to ${formatDate(dateTo)} · ${formatLocation(loc)}</p>
            </div>

            <!-- Summary Cards -->
            <div class="kpi-grid" style="margin-bottom:24px">
                <div class="kpi-card kpi-sales">
                    <div class="kpi-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="kpi-info"><span class="kpi-label">Total Sales</span><span class="kpi-value">${formatCurrency(totalSales)}</span></div>
                </div>
                <div class="kpi-card kpi-expense">
                    <div class="kpi-icon"><i class="fas fa-arrow-down"></i></div>
                    <div class="kpi-info"><span class="kpi-label">Total Expenses</span><span class="kpi-value">${formatCurrency(totalExpenses)}</span></div>
                </div>
                <div class="kpi-card ${profit >= 0 ? 'kpi-sales' : 'kpi-expense'}">
                    <div class="kpi-icon"><i class="fas fa-${profit >= 0 ? 'trophy' : 'exclamation-triangle'}"></i></div>
                    <div class="kpi-info"><span class="kpi-label">Profit / Loss</span><span class="kpi-value">${formatCurrency(profit)}</span></div>
                </div>
                <div class="kpi-card kpi-orders">
                    <div class="kpi-icon"><i class="fas fa-clipboard-list"></i></div>
                    <div class="kpi-info"><span class="kpi-label">Orders</span><span class="kpi-value">${totalOrders} (${deliveredOrders} delivered)</span></div>
                </div>
                <div class="kpi-card kpi-monthly-sales">
                    <div class="kpi-icon"><i class="fas fa-hand-holding-usd"></i></div>
                    <div class="kpi-info"><span class="kpi-label">Collections</span><span class="kpi-value">${formatCurrency(totalCollections)}</span></div>
                </div>
            </div>

            <!-- Product Sales -->
            <div class="dashboard-section">
                <div class="section-header"><h2><i class="fas fa-ice-cream"></i> Product Sales</h2></div>
                <table class="data-table">
                    <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
                    <tbody>
                        ${Object.entries(productSales)
                            .sort((a, b) => b[1].revenue - a[1].revenue)
                            .map(([name, data]) => `
                                <tr><td>${name}</td><td>${data.qty}</td><td><strong>${formatCurrency(data.revenue)}</strong></td></tr>
                            `).join('') || '<tr><td colspan="3" class="no-data">No product sales</td></tr>'}
                    </tbody>
                </table>
            </div>

            <!-- Expense Breakdown -->
            <div class="dashboard-section" style="margin-top:16px">
                <div class="section-header"><h2><i class="fas fa-receipt"></i> Expense Breakdown</h2></div>
                <table class="data-table">
                    <thead><tr><th>Category</th><th>Amount</th></tr></thead>
                    <tbody>
                        ${Object.entries(expenseByCategory)
                            .sort((a, b) => b[1] - a[1])
                            .map(([cat, amount]) => `
                                <tr><td>${cat}</td><td><strong>${formatCurrency(amount)}</strong></td></tr>
                            `).join('') || '<tr><td colspan="2" class="no-data">No expenses</td></tr>'}
                    </tbody>
                </table>
            </div>

            <!-- Top Customers -->
            <div class="dashboard-section" style="margin-top:16px">
                <div class="section-header"><h2><i class="fas fa-users"></i> Customer Sales</h2></div>
                <table class="data-table">
                    <thead><tr><th>Customer</th><th>Orders</th><th>Revenue</th></tr></thead>
                    <tbody>
                        ${Object.entries(customerSales)
                            .sort((a, b) => b[1].revenue - a[1].revenue)
                            .map(([name, data]) => `
                                <tr><td>${name}</td><td>${data.orders}</td><td><strong>${formatCurrency(data.revenue)}</strong></td></tr>
                            `).join('') || '<tr><td colspan="3" class="no-data">No customer data</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        // Store data for export
        window._reportData = {
            summary: {
                'Report Type': capitalize(currentReportType),
                'From': dateFrom, 'To': dateTo,
                'Location': formatLocation(loc),
                'Total Sales': totalSales,
                'Total Expenses': totalExpenses,
                'Profit/Loss': profit,
                'Total Orders': totalOrders,
                'Collections': totalCollections
            },
            products: Object.entries(productSales).map(([name, d]) => ({ Product: name, Qty: d.qty, Revenue: d.revenue })),
            expenses: Object.entries(expenseByCategory).map(([cat, amt]) => ({ Category: cat, Amount: amt })),
            customers: Object.entries(customerSales).map(([name, d]) => ({ Customer: name, Orders: d.orders, Revenue: d.revenue }))
        };

    } catch (e) {
        content.innerHTML = '<p class="no-data">Error generating report</p>';
        console.error('Report error:', e);
    }
}

function exportReport() {
    if (!window._reportData) {
        showToast('Generate a report first', 'warning');
        return;
    }

    const d = window._reportData;

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryWS = XLSX.utils.json_to_sheet([d.summary]);
    XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');

    // Products sheet
    if (d.products.length > 0) {
        const prodWS = XLSX.utils.json_to_sheet(d.products);
        XLSX.utils.book_append_sheet(wb, prodWS, 'Product Sales');
    }

    // Expenses sheet
    if (d.expenses.length > 0) {
        const expWS = XLSX.utils.json_to_sheet(d.expenses);
        XLSX.utils.book_append_sheet(wb, expWS, 'Expenses');
    }

    // Customers sheet
    if (d.customers.length > 0) {
        const custWS = XLSX.utils.json_to_sheet(d.customers);
        XLSX.utils.book_append_sheet(wb, custWS, 'Customer Sales');
    }

    XLSX.writeFile(wb, `IR_Pudding_Report_${getTodayStr()}.xlsx`);
    showToast('Report exported to Excel!', 'success');
}

console.log('📈 Reports module loaded');
