// ============================================
// IR PUDDING TRACKING - DASHBOARD
// ============================================

let salesChart = null;
let productsChart = null;

function initDashboard() {
    console.log('📊 Dashboard module loaded');
}

async function loadDashboard() {
    if (!currentUser) return;

    const today = getTodayStr();
    const monthStr = getMonthStr();
    const loc = getActiveLocation();

    try {
        // Load orders for today
        const ordersSnap = await dbRef.orders.once('value');
        const orders = ordersSnap.val() || {};

        let dailySales = 0;
        let monthlySales = 0;
        let todayOrders = 0;
        let pendingTotal = 0;
        let recentOrdersList = [];
        let productCounts = {};

        Object.entries(orders).forEach(([id, order]) => {
            // Location filter
            if (loc !== 'all' && order.location !== loc) return;

            const orderDate = order.date || '';
            const orderMonth = orderDate.substring(0, 7);

            // Today's orders count
            if (orderDate === today) {
                todayOrders++;
                if (order.total) dailySales += parseFloat(order.total) || 0;
            }

            // Monthly sales
            if (orderMonth === monthStr && order.total) {
                monthlySales += parseFloat(order.total) || 0;
            }

            // Pending payments
            if (order.paymentStatus === 'pending' || order.paymentStatus === 'partial') {
                const paid = parseFloat(order.paidAmount) || 0;
                const total = parseFloat(order.total) || 0;
                pendingTotal += (total - paid);
            }

            // Recent orders (last 10)
            recentOrdersList.push({ id, ...order });

            // Product counts
            if (order.items) {
                order.items.forEach(item => {
                    const key = item.productName || item.productId;
                    if (key) {
                        productCounts[key] = (productCounts[key] || 0) + (parseInt(item.qty) || 0);
                    }
                });
            }
        });

        // Load expenses
        const expSnap = await dbRef.expenses.once('value');
        const expenses = expSnap.val() || {};
        let dailyExpense = 0;
        let monthlyExpense = 0;

        Object.values(expenses).forEach(exp => {
            if (loc !== 'all' && exp.location !== loc && exp.location !== 'general') return;
            const expDate = exp.date || '';
            const expMonth = expDate.substring(0, 7);

            if (expDate === today) dailyExpense += parseFloat(exp.amount) || 0;
            if (expMonth === monthStr) monthlyExpense += parseFloat(exp.amount) || 0;
        });

        // Update KPI cards
        if (isOwner()) {
            document.getElementById('kpiDailySales').textContent = formatCurrency(dailySales);
            document.getElementById('kpiDailyExpense').textContent = formatCurrency(dailyExpense);
            document.getElementById('kpiMonthlySales').textContent = formatCurrency(monthlySales);
            document.getElementById('kpiMonthlyExpense').textContent = formatCurrency(monthlyExpense);
            document.getElementById('kpiPending').textContent = formatCurrency(pendingTotal);
        }
        document.getElementById('kpiTodayOrders').textContent = todayOrders;

        // Update pending badge
        const pendingCount = Object.values(orders).filter(o =>
            (o.paymentStatus === 'pending' || o.paymentStatus === 'partial') &&
            o.status === 'delivered' &&
            (loc === 'all' || o.location === loc)
        ).length;
        const badges = document.querySelectorAll('#pendingBadge, #pendingCount');
        badges.forEach(b => { if (b) b.textContent = pendingCount; });

        // Low Stock Alerts
        await loadLowStockAlerts(loc);

        // Recent Orders Table
        loadRecentOrders(recentOrdersList.slice(-10).reverse());

        // Charts (Owner only)
        if (isOwner()) {
            await loadSalesChart(orders, loc);
            loadProductsChart(productCounts);
        }

    } catch (e) {
        console.error('Dashboard load error:', e);
    }
}

async function loadLowStockAlerts(loc) {
    const container = document.getElementById('lowStockAlerts');
    if (!container) return;

    const locations = loc === 'all' ? ['bangalore', 'chennai'] : [loc];
    let alerts = [];

    for (const location of locations) {
        for (const type of ['food', 'nonfood']) {
            try {
                const snap = await dbRef.stock.child(`${location}/${type}`).once('value');
                const items = snap.val() || {};

                Object.entries(items).forEach(([key, item]) => {
                    if (item.threshold && item.qty <= item.threshold) {
                        const severity = item.qty <= item.threshold * 0.5 ? 'critical' : 'warning';
                        alerts.push({
                            name: item.name,
                            qty: item.qty,
                            unit: item.unit,
                            threshold: item.threshold,
                            location: capitalize(location),
                            severity
                        });
                    }
                });
            } catch (e) { /* ignore */ }
        }
    }

    if (alerts.length === 0) {
        container.innerHTML = '<p class="no-data">✅ All stock levels are healthy</p>';
    } else {
        container.innerHTML = alerts.map(a => `
            <div class="alert-item ${a.severity}">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>${a.name}</strong>: ${a.qty} ${a.unit} (min: ${a.threshold})
                <small>- ${a.location}</small>
            </div>
        `).join('');
    }
}

function loadRecentOrders(orders) {
    const container = document.getElementById('recentOrders');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = '<p class="no-data">No recent orders</p>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th>Status</th>
                    ${isOwner() ? '<th>Amount</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${orders.map(o => `
                    <tr>
                        <td>${formatDate(o.date)}</td>
                        <td>${o.customerName || '-'}</td>
                        <td>${o.invoiceNo || '-'}</td>
                        <td>${getStatusBadge(o.status || 'placed')}</td>
                        ${isOwner() ? `<td><strong>${formatCurrency(o.total)}</strong></td>` : ''}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function loadSalesChart(orders, loc) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    // Get last 7 days
    const labels = [];
    const salesData = [];
    const expenseData = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));

        let daySales = 0;
        Object.values(orders).forEach(o => {
            if (o.date === dateStr && (loc === 'all' || o.location === loc)) {
                daySales += parseFloat(o.total) || 0;
            }
        });
        salesData.push(daySales);
    }

    // Destroy existing chart
    if (salesChart) salesChart.destroy();

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sales (₹)',
                data: salesData,
                borderColor: '#27AE60',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointBackgroundColor: '#27AE60',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: val => '₹' + val.toLocaleString('en-IN')
                    }
                }
            }
        }
    });
}

function loadProductsChart(productCounts) {
    const ctx = document.getElementById('productsChart');
    if (!ctx) return;

    const sorted = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const labels = sorted.map(s => s[0]);
    const data = sorted.map(s => s[1]);

    const colors = ['#E85D2C', '#F39C12', '#27AE60', '#3498DB', '#9B59B6', '#E74C3C'];

    if (productsChart) productsChart.destroy();

    productsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 11 } }
                }
            }
        }
    });
}

console.log('📊 Dashboard module loaded');
