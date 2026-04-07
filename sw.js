const CACHE_VERSION = 'ir-pudding-v1.7';
const ASSETS = [
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

// Install — cache assets & activate immediately
self.addEventListener('install', e => {
  self.skipWaiting(); // Don't wait for old tabs to close
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS))
  );
});

// Activate — delete old caches & take control immediately
self.addEventListener('activate', e => {
  self.clients.claim(); // Take control of all tabs now
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key !== CACHE_VERSION)
        .map(key => caches.delete(key))
      )
    )
  );
});

// Fetch — Network First for app files, Cache First for CDN
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // CDN/external resources: Cache First (they never change)
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // App files: Network First (always get latest, fallback to cache offline)
  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
