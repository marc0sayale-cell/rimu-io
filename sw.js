// ═══════════════════════════════════════════════════════════════
//  RIMU.IO — Service Worker v4
//  Arquivo: sw.js (deve ficar na raiz do repositório GitHub)
// ═══════════════════════════════════════════════════════════════

const CACHE = 'rimu-v4';
const OFFLINE_URL = './index.html';

// ── INSTALL: cacheia o app ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([OFFLINE_URL, './']))
    .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpa caches velhos ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: serve do cache, atualiza em background ──
self.addEventListener('fetch', e => {
  // Não intercepta chamadas à API Anthropic/Firebase
  if (e.request.url.includes('api.anthropic.com') ||
      e.request.url.includes('firebase') ||
      e.request.url.includes('googleapis') ||
      e.request.url.includes('workers.dev')) {
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(c =>
      c.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          if (res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});

// ── PUSH: recebe notificações do servidor (futuro) ──
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'Rimu.io', {
      body: data.body || '',
      icon: data.icon || './icon-192.png',
      badge: './icon-192.png',
      tag: data.tag || 'rimu-push',
      vibrate: [200, 100, 200],
      data: data.url ? { url: data.url } : {}
    })
  );
});

// ── NOTIFICATION CLICK: abre o app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const url = e.notification.data?.url || './';
      const open = cls.find(c => c.url.includes('rimu') && 'focus' in c);
      if (open) return open.focus();
      return clients.openWindow(url);
    })
  );
});

// ── MESSAGE: permite agendar notificações locais via postMessage ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIF') {
    const { title, body, delayMs, tag } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: './icon-192.png',
        tag: tag || 'rimu-local',
        vibrate: [200, 100, 200],
      });
    }, delayMs || 1000);
  }
});
