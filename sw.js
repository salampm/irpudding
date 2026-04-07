const cacheName = 'ir-pudding-v1';
const assets = [
  './',
  './index.html',
  './css/style.css',
  './css/mobile.css',
  './js/app.js',
  './js/auth.js',
  './js/utils.js',
  './js/dashboard.js',
  './js/stock.js',
  './js/inventory.js',
  './js/purchases.js',
  './js/transfers.js',
  './js/customers.js',
  './js/pos.js',
  './js/payments.js',
  './js/expenses.js',
  './js/salary.js',
  './js/reports.js',
  './js/settings.js',
  './js/firebase-config.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// Install Service Worker
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      cache.addAll(assets);
    })
  );
});

// Activate Service Worker
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        .filter(key => key !== cacheName)
        .map(key => caches.delete(key))
      );
    })
  );
});

// Fetch Assets
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cacheRes => {
      return cacheRes || fetch(e.request);
    })
  );
});
