// ============================================
// IR PUDDING TRACKING - STAFF & SALARY
// ============================================

function initSalary() {
    console.log('💼 Salary module loaded');
}

async function loadStaff() {
    if (!isOwner()) return;

    const container = document.getElementById('staffGrid');
    if (!container) return;

    container.innerHTML = '<p class="no-data">Loading...</p>';

    try {
        const snap = await dbRef.staff.once('value');
        const staffList = snap.val() || {};

        if (Object.keys(staffList).length === 0) {
            container.innerHTML = '<p class="no-data">No staff added yet. Click "Add Staff" to start.</p>';
            return;
        }

        // Load advances
        const advSnap = await dbRef.salaryLogs.once('value');
        const salaryLogs = advSnap.val() || {};

        container.innerHTML = Object.entries(staffList).map(([id, s]) => {
            const initials = (s.name || 'S').substring(0, 2).toUpperCase();

            // Calculate total advances (unpaid)
            let totalAdvances = 0;
            Object.values(salaryLogs).forEach(log => {
                if (log.staffId === id && log.type === 'advance') {
                    totalAdvances += parseFloat(log.amount) || 0;
                }
            });

            // Deductions
            let totalDeductions = 0;
            Object.values(salaryLogs).forEach(log => {
                if (log.staffId === id && log.type === 'deduction') {
                    totalDeductions += parseFloat(log.amount) || 0;
                }
            });

            return `
                <div class="staff-card">
                    <div class="staff-card-header">
                        <div class="staff-avatar">${initials}</div>
                        <div>
                            <h3>${s.name}</h3>
                            <small>${s.role || 'Staff'} · ${capitalize(s.location || 'bangalore')}</small>
                        </div>
                    </div>
                    <div class="staff-details">
                        <div><span>Phone:</span> <strong>${s.phone || '-'}</strong></div>
                        <div><span>Monthly Salary:</span> <strong>${formatCurrency(s.salary)}</strong></div>
                        <div><span>Total Advances:</span> <strong class="text-warning">${formatCurrency(totalAdvances)}</strong></div>
                        <div><span>Deductions:</span> <strong>${formatCurrency(totalDeductions)}</strong></div>
                        <div><span>Join Date:</span> <strong>${formatDate(s.joinDate)}</strong></div>
                    </div>
                    <div class="actions">
                        <button class="btn-sm btn-outline" onclick='openModal("staffAdvance", ${JSON.stringify({id, name: s.name})})'>
                            <i class="fas fa-money-bill"></i> Advance
                        </button>
                        <button class="btn-sm btn-outline" onclick="recordSalaryPayment('${id}', '${s.name}', ${s.salary || 0})">
                            <i class="fas fa-wallet"></i> Pay Salary
                        </button>
                        <button class="btn-icon" onclick='editStaffMember("${id}", ${JSON.stringify(s)})'>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" onclick="deleteStaffMember('${id}','${s.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p class="no-data">Error loading staff</p>';
        console.error('Staff error:', e);
    }
}

async function saveStaffMember() {
    const name = document.getElementById('modalStaffName').value.trim();
    const phone = document.getElementById('modalStaffPhone').value.trim();
    const location = document.getElementById('modalStaffLocation').value;
    const salary = parseFloat(document.getElementById('modalStaffSalary').value) || 0;
    const role = document.getElementById('modalStaffRole').value.trim();
    const joinDate = document.getElementById('modalStaffJoinDate').value;

    if (!name) {
        showToast('Please enter staff name', 'error');
        return;
    }

    try {
        const id = generateId();
        await dbRef.staff.child(id).set({
            name, phone, location, salary, role, joinDate,
            createdAt: Date.now()
        });

        closeModal();
        showToast(`${name} added to staff!`, 'success');
        loadStaff();
    } catch (e) {
        showToast('Error saving staff', 'error');
    }
}

function editStaffMember(id, staff) {
    openModal('addStaff');
    setTimeout(() => {
        document.getElementById('modalTitle').textContent = '✏️ Edit Staff';
        document.getElementById('modalStaffName').value = staff.name || '';
        document.getElementById('modalStaffPhone').value = staff.phone || '';
        document.getElementById('modalStaffLocation').value = staff.location || 'bangalore';
        document.getElementById('modalStaffSalary').value = staff.salary || 0;
        document.getElementById('modalStaffRole').value = staff.role || '';
        document.getElementById('modalStaffJoinDate').value = staff.joinDate || '';

        const saveBtn = document.querySelector('#modalBody .btn-primary');
        if (saveBtn) {
            saveBtn.onclick = async function () {
                try {
                    await dbRef.staff.child(id).update({
                        name: document.getElementById('modalStaffName').value.trim(),
                        phone: document.getElementById('modalStaffPhone').value.trim(),
                        location: document.getElementById('modalStaffLocation').value,
                        salary: parseFloat(document.getElementById('modalStaffSalary').value) || 0,
                        role: document.getElementById('modalStaffRole').value.trim(),
                        joinDate: document.getElementById('modalStaffJoinDate').value
                    });
                    closeModal();
                    showToast('Staff updated!', 'success');
                    loadStaff();
                } catch (e) { showToast('Error updating', 'error'); }
            };
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Update';
        }
    }, 100);
}

async function deleteStaffMember(id, name) {
    const confirmed = await confirmAction(`Remove "${name}" from staff?`);
    if (!confirmed) return;

    try {
        await dbRef.staff.child(id).remove();
        showToast(`${name} removed`, 'success');
        loadStaff();
    } catch (e) {
        showToast('Error deleting staff', 'error');
    }
}

async function saveAdvance() {
    const staffId = document.getElementById('modalAdvStaffId').value;
    const date = document.getElementById('modalAdvDate').value;
    const amount = parseFloat(document.getElementById('modalAdvAmount').value) || 0;
    const reason = document.getElementById('modalAdvReason').value.trim();

    if (amount <= 0) {
        showToast('Enter a valid amount', 'error');
        return;
    }

    try {
        const id = generateId();
        await dbRef.salaryLogs.child(id).set({
            staffId, type: 'advance', date, amount, reason,
            createdAt: Date.now()
        });

        closeModal();
        showToast(`Advance of ${formatCurrency(amount)} recorded`, 'success');
        loadStaff();
    } catch (e) {
        showToast('Error recording advance', 'error');
    }
}

async function recordSalaryPayment(staffId, name, monthlySalary) {
    const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    // Calculate advances for this staff
    try {
        const logSnap = await dbRef.salaryLogs.once('value');
        const logs = logSnap.val() || {};

        let totalAdvances = 0;
        Object.values(logs).forEach(log => {
            if (log.staffId === staffId && log.type === 'advance') {
                totalAdvances += parseFloat(log.amount) || 0;
            }
        });

        let totalDeductions = 0;
        Object.values(logs).forEach(log => {
            if (log.staffId === staffId && log.type === 'deduction') {
                totalDeductions += parseFloat(log.amount) || 0;
            }
        });

        const netPay = monthlySalary - (totalAdvances - totalDeductions);

        const confirmed = await confirmAction(
            `Pay salary to ${name} for ${month}?\n\n` +
            `Monthly Salary: ${formatCurrency(monthlySalary)}\n` +
            `Advances: ${formatCurrency(totalAdvances)}\n` +
            `Deductions: ${formatCurrency(totalDeductions)}\n` +
            `Net Pay: ${formatCurrency(Math.max(0, netPay))}`
        );

        if (!confirmed) return;

        // Record salary payment
        const id = generateId();
        await dbRef.salaryLogs.child(id).set({
            staffId, type: 'salary_payment',
            date: getTodayStr(),
            month: getMonthStr(),
            salary: monthlySalary,
            advances: totalAdvances,
            deductions: totalDeductions,
            netPay: Math.max(0, netPay),
            createdAt: Date.now()
        });

        // Also add as expense
        const expId = generateId();
        await dbRef.expenses.child(expId).set({
            date: getTodayStr(),
            category: 'salary',
            categoryName: 'Salary',
            amount: Math.max(0, netPay),
            description: `Salary: ${name} (${month})`,
            location: 'general',
            createdAt: Date.now()
        });

        showToast(`Salary paid to ${name}: ${formatCurrency(Math.max(0, netPay))}`, 'success');
        loadStaff();
    } catch (e) {
        showToast('Error processing salary', 'error');
    }
}

console.log('💼 Salary module loaded');
