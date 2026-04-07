// ============================================
// IR PUDDING TRACKING - AUTHENTICATION
// ============================================

let currentUser = null;
let currentRole = null;
let currentLocation = 'all';
let selectedLocation = 'all';

const ROLES = {
    OWNER: 'owner',
    STAFF_BLR: 'staff_blr',
    STAFF_CHN: 'staff_chn'
};

// Owner UID - hardcoded for security
const OWNER_UID = 'HfYIMnXNIgZ82UgCtcASxZqAO0h2';

// ---- Auth State Listener ----
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            console.log('🔑 User signed in:', user.uid, user.email);

            // Check if user data exists in DB
            const snapshot = await dbRef.users.child(user.uid).once('value');
            let userData = snapshot.val();

            // If user is the owner but no DB record yet, auto-create
            if (!userData && user.uid === OWNER_UID) {
                console.log('👑 First-time owner login. Creating owner record...');
                userData = {
                    name: 'Abdul',
                    role: ROLES.OWNER,
                    email: user.email,
                    location: 'all',
                    phone: '',
                    createdAt: Date.now()
                };
                await dbRef.users.child(user.uid).set(userData);
                console.log('✅ Owner record created in database');
            }

            // If user exists but is NOT in DB and NOT the owner
            if (!userData && user.uid !== OWNER_UID) {
                // Could be a new staff member - check if owner approved them
                // For now, create a pending record
                console.log('⚠️ Unknown user. Creating pending staff record...');
                userData = {
                    name: user.email.split('@')[0],
                    role: 'pending',
                    email: user.email,
                    location: 'bangalore',
                    phone: '',
                    createdAt: Date.now(),
                    approved: false
                };
                await dbRef.users.child(user.uid).set(userData);

                // Show message and logout
                alert('Your account is pending approval from the owner. Please contact the admin.');
                await auth.signOut();
                return;
            }

            // Check if pending approval
            if (userData.role === 'pending' || userData.approved === false) {
                alert('Your account is pending approval. Please contact the admin.');
                await auth.signOut();
                return;
            }

            // Set current user
            currentUser = {
                uid: user.uid,
                email: user.email,
                name: userData.name || user.email,
                role: userData.role,
                phone: userData.phone || '',
                location: userData.location || 'all'
            };
            currentRole = userData.role;
            currentLocation = userData.location || 'all';
            selectedLocation = currentRole === ROLES.OWNER ? 'all' : currentLocation;

            console.log('✅ Logged in as:', currentRole, '| Location:', currentLocation);
            showApp();

        } catch (error) {
            console.error('❌ Auth error:', error);

            // If it's a permission error, the database rules might be wrong
            if (error.code === 'PERMISSION_DENIED' || (error.message && error.message.includes('Permission denied'))) {
                alert('Database permission denied. Please update Firebase Realtime Database rules to:\n\n{"rules": {".read": "auth != null", ".write": "auth != null"}}');
            } else {
                showToast('Authentication error: ' + error.message, 'error');
            }
            await auth.signOut();
        }
    } else {
        console.log('🔒 No user signed in');
        showLogin();
    }
});

// ---- Login ----
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    errorDiv.textContent = '';

    const btn = e.target.querySelector('.btn-login');
    const originalText = btn.innerHTML;

    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        btn.disabled = true;

        console.log('🔄 Attempting login with:', email);
        await auth.signInWithEmailAndPassword(email, password);
        console.log('✅ Login successful');
        // onAuthStateChanged will handle the rest

    } catch (error) {
        console.error('❌ Login error:', error.code, error.message);

        let msg = 'Login failed. Please try again.';
        switch (error.code) {
            case 'auth/user-not-found':
                msg = 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                msg = 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                msg = 'Invalid email address.';
                break;
            case 'auth/too-many-requests':
                msg = 'Too many failed attempts. Please wait and try again.';
                break;
            case 'auth/invalid-credential':
                msg = 'Invalid email or password. Please check and try again.';
                break;
            case 'auth/network-request-failed':
                msg = 'Network error. Check your internet connection.';
                break;
            default:
                msg = error.message || 'Login failed.';
        }

        errorDiv.textContent = msg;
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// ---- Logout ----
function logout() {
    auth.signOut().then(() => {
        currentUser = null;
        currentRole = null;
        currentLocation = 'all';
        showLogin();
    });
}

// ---- Show Login Screen ----
function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').textContent = '';

    const btn = document.querySelector('.btn-login');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        btn.disabled = false;
    }
}

// ---- Show Main App ----
function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    applyRolePermissions();
    updateUserUI();

    // Small delay to ensure DOM is ready
    setTimeout(() => {
        if (typeof initApp === 'function') {
            initApp();
        }
    }, 100);
}

// ---- Apply Role-Based Visibility ----
function applyRolePermissions() {
    const ownerElements = document.querySelectorAll('.owner-only');
    const isOwnerRole = currentRole === ROLES.OWNER;

    ownerElements.forEach(el => {
        if (isOwnerRole) {
            el.style.removeProperty('display');
        } else {
            el.style.display = 'none';
        }
    });

    // Location switcher only for owner
    const locSwitcher = document.getElementById('locationSwitcher');
    if (locSwitcher) {
        locSwitcher.style.display = isOwnerRole ? 'flex' : 'none';
    }

    // Staff location badge
    if (!isOwnerRole) {
        const locationBadge = document.getElementById('headerLocation');
        if (locationBadge) {
            locationBadge.textContent = currentLocation === 'bangalore' ? '📍 Bangalore' : '📍 Chennai';
            locationBadge.style.display = 'inline-block';
        }
    }
}

// ---- Update User Info UI ----
function updateUserUI() {
    const roleLabels = {
        [ROLES.OWNER]: 'Owner',
        [ROLES.STAFF_BLR]: 'Staff - Bangalore',
        [ROLES.STAFF_CHN]: 'Staff - Chennai'
    };

    const roleName = roleLabels[currentRole] || currentRole;

    // Header user info
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        userInfo.innerHTML = `<strong>${currentUser.name}</strong>${roleName}`;
    }

    // Sidebar user info
    const sidebarUser = document.getElementById('sidebarUser');
    if (sidebarUser) {
        sidebarUser.innerHTML = `<strong>${currentUser.name}</strong><span>${roleName}</span>`;
    }

    // Header location for owner
    if (currentRole === ROLES.OWNER) {
        const locationBadge = document.getElementById('headerLocation');
        if (locationBadge) {
            locationBadge.textContent = '🌐 All Locations';
        }
    }
}

// ---- Toggle Password Visibility ----
function togglePassword() {
    const input = document.getElementById('loginPassword');
    const icon = document.querySelector('.toggle-password i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// ---- Toggle User Menu ----
function toggleUserMenu() {
    document.getElementById('userDropdown').classList.toggle('show');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) dropdown.classList.remove('show');
    }
});

// ---- Helper Functions ----
function isOwner() {
    return currentRole === ROLES.OWNER;
}

function getActiveLocation() {
    if (currentRole === ROLES.OWNER) return selectedLocation;
    return currentLocation;
}

// ---- Create Staff Accounts (Owner Only) ----
// This function will be called from Settings
async function createStaffAccount(email, password, name, role, location) {
    if (!isOwner()) {
        showToast('Only owner can create staff accounts', 'error');
        return false;
    }

    try {
        // We can't create users from client-side without signing them in
        // So we'll use a workaround: save the intended role in DB
        // and when they first login, the auth listener assigns the role

        // For now, we need to create users via Firebase Console
        // But we can pre-register their role in the database

        const tempId = 'pending_' + Date.now();
        await db.ref('pending_staff').child(tempId).set({
            email: email,
            name: name,
            role: role,
            location: location,
            createdAt: Date.now(),
            createdBy: currentUser.uid
        });

        showToast(`Staff account prepared for ${email}. Create this user in Firebase Console Authentication, then their role will be auto-assigned.`, 'success');
        return true;

    } catch (e) {
        console.error('Create staff error:', e);
        showToast('Error creating staff account: ' + e.message, 'error');
        return false;
    }
}

console.log('🔐 Auth module loaded');
