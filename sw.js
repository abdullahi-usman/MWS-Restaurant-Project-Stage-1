const cacheName = 'restaurant-reviews-v1';
const offlineWeb = ['./', 'index.html', 'restaurant.html', 'js/a11yhelper.js', 'js/dbhelper.js', 'js/restaurant_info.js', 'js/main.js', 'css/styles.css', 'data/restaurants.json'];
const leafletOfflineWeb = ['https://unpkg.com/leaflet@1.3.1/dist/leaflet.css', 'https://unpkg.com/leaflet@1.3.1/dist/leaflet.js']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => {
    cache.addAll(leafletOfflineWeb)
    return cache.addAll(offlineWeb)
  }));
})

self.addEventListener('fetch', event => {

  event.respondWith(caches.match(event.request).then(response => {

    return response || fetch(event.request.url).then(url_response => {

      if (url_response && url_response.ok && (url_response.url.endsWith('.jpg')) ||
        url_response.url.endsWith('.png') || url_response.url.startsWith('https://api.tiles.mapbox.com')) {
        caches.open(cacheName).then(cache => cache.put(url_response.url, url_response)).catch(reason => console.log(reason));
      }

      return url_response.clone();
    }).catch(reason => {
      console.log(reason.message);
    })
  }))
})

self.addEventListener('message', event => {

  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }

});