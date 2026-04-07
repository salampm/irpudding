// ============================================
// IR PUDDING TRACKING - FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyCQNi-CBBKe2bweL5-jX0iAJ073pJh2IWM",
    authDomain: "ir-pudding.firebaseapp.com",
    databaseURL: "https://ir-pudding-default-rtdb.firebaseio.com",
    projectId: "ir-pudding",
    storageBucket: "ir-pudding.firebasestorage.app",
    messagingSenderId: "264994429185",
    appId: "1:264994429185:web:f106c67ee046900d13a300"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase References
const auth = firebase.auth();
const db = firebase.database();

// Database References
const dbRef = {
    users: db.ref('users'),
    stock: db.ref('stock'),
    suppliers: db.ref('suppliers'),
    purchases: db.ref('purchases'),
    transfers: db.ref('transfers'),
    products: db.ref('products'),
    recipes: db.ref('recipes'),
    customers: db.ref('customers'),
    orders: db.ref('orders'),
    payments: db.ref('payments'),
    expenses: db.ref('expenses'),
    staff: db.ref('staff'),
    salaryLogs: db.ref('salary_logs'),
    settings: db.ref('settings'),
    expenseCategories: db.ref('expense_categories'),
    dailyStock: db.ref('dailyStock'),
    inventoryLedger: db.ref('inventoryLedger'),
    wastage: db.ref('wastage'),
    units: db.ref('units')
};

console.log('🍮 IR Pudding Firebase initialized');
