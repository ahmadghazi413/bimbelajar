// public/sw.js - Menangani notifikasi Chrome HP di latar belakang

self.addEventListener('push', function (event) {
  if (!event.data) return;

  let payload = {
    title: 'Info PadatIlmu',
    body: 'Ada pembaruan kelas atau jadwal untuk Anda.',
    url: '/_authenticated/kelas-saya',
    icon: '/favicon.ico',
  };

  try {
    payload = event.data.json();
  } catch (e) {
    payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200], // Getar HP
    data: {
      url: payload.url || '/_authenticated/kelas-saya',
    },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
