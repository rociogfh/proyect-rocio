/* ================== VERSIONES DE CACHÉ ================== */
const SHELL_CACHE = "shell-cache-v5";   // <- súbelo si cambias el SW
const IMG_CACHE   = "img-cache-v3";
const DATA_CACHE  = "data-cache-v3";

/* ================== APP SHELL PRECACHE ================== */
const CORE_ASSETS = [
  "/", "/index.html", "/offline.html" , "/manifest.json"
];

/* ================== IndexedDB helpers mínimos ================== */
const DB_NAME = "TasksDB";
const OUTBOX_STORE = "outbox";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("entries"))
        db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("outbox"))
        db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function outboxAll() {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(OUTBOX_STORE, "readonly");
    const req = tx.objectStore(OUTBOX_STORE).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function outboxDel(id) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    tx.objectStore(OUTBOX_STORE).delete(id);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

/* ================== INSTALL / ACTIVATE ================== */
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        if (![SHELL_CACHE, IMG_CACHE, DATA_CACHE].includes(k)) {
          return caches.delete(k);
        }
      })
    );
    self.clients.claim();
  })());
});

/* ================== FETCH (Estrategias) ================== */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // === Navegaciones (documentos/SPA)
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        // Network-first para frescura
        const net = await fetch(req);
        // (opcional) cachea la última versión navegada
        cache.put(req, net.clone());
        return net;
      } catch {
        // 🔴 Sin conexión -> SIEMPRE offline.html
        const offline = await cache.match("/offline.html");
        return offline || new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })());
    return;
  }

  // === App Shell estático: cache-first
  if (CORE_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((r) => r || fetch(req)));
    return;
  }

  // === Imágenes: stale-while-revalidate
  if (/\.(png|jpg|jpeg|svg|webp|gif|ico)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(req);
      const netPromise = fetch(req)
        .then((r) => {
          cache.put(req, r.clone());
          return r;
        })
        .catch(() => undefined);
      return cached || netPromise || new Response("", { status: 204 });
    })());
    return;
  }

  // === Datos / APIs: network-first con caché de respaldo
  if (url.pathname.startsWith("/api/")) {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(DATA_CACHE);
        cache.put(req, net.clone());
        return net;
      } catch {
        const cache = await caches.open(DATA_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        return new Response(JSON.stringify({ ok: false, offline: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }
    })());
    return;
  }

  // Resto de peticiones: intenta red y cae a caché si existe
  event.respondWith((async () => {
    try {
      return await fetch(req);
    } catch {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req);
      return cached || new Response("", { status: 204 });
    }
  })());
});

/* ================== BACKGROUND SYNC ================== */
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-entries") {
    event.waitUntil(syncOutbox());
  }
});

async function syncOutbox() {
  try {
    const items = await outboxAll();
    for (const it of items) {
      // Ajusta el endpoint a tu backend (o Cloud Function)
      const resp = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(it),
      });
      if (resp.ok) await outboxDel(it.id);
    }
  } catch {
    // se reintentará en el próximo 'sync'
  }
}

/* ================== PUSH (genérico, no FCM) ================== */
self.addEventListener("push", (event) => {
  // Si usas VAPID propio y envías {title, body, url}
  const data = event.data ? event.data.json() : { title: "Notificación", body: "Hola 👋" };
  event.waitUntil(
    self.registration.showNotification(data.title || "Notificación", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.openWindow(url));
});
