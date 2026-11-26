// Kwenta service worker: lets the app open and work without internet.
// Pages: try the network first, fall back to the saved copy.
// Scripts, styles, logos: use the saved copy, refresh it in the background.
const CACHE = "kwenta-v3";
const DATA_CACHE = "kwenta-data";
const DATA_URL = "/__kwenta-reminders.json";
const CORE = ["/", "/manifest.webmanifest", "/icons/icon-192.png?v=2", "/icons/icon-512.png?v=2"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      // Keep the reminder list ("kwenta-data"); remove only old app caches.
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    // Each page is saved under its own address. Only the app itself ("/") is the offline fallback,
    // so opening a public page like /love never replaces the saved app.
    const key = url.pathname === "/" ? "/" : req;
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(() => caches.match(key).then((hit) => hit || caches.match("/"))),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    }),
  );
});

// ---------- Daily reminders (Periodic Background Sync, Android Chrome) ----------
// The app saves a small list of what's due (titles + dates, no amounts) to Cache Storage.
// About once a day Chrome wakes this worker; it reads the list and shows notifications.

const DAY = 86400000;
const startOfDay = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

async function readData() {
  const cache = await caches.open(DATA_CACHE);
  const res = await cache.match(DATA_URL);
  return res ? res.json() : null;
}

// What to say about what's due today, or null when nothing is. Snoozed items wait for their return day.
function dueNotification(data, today) {
  // An item may notify from its own start day (cards can start earlier); older saved lists fall back to the day before.
  const ready = (data.items || []).filter((i) => (i.from ?? i.due - DAY) <= today && (i.hideUntil ?? 0) <= today);
  const stmts = ready.filter((i) => i.kind === "statement");
  const due = ready.filter((i) => i.kind !== "statement");
  if (!due.length && !stmts.length) return null;
  const overdue = due.filter((i) => i.due < today);
  const lines = [
    ...stmts.map((i) => `• ${i.title}: ready, check the balance`),
    ...due.map((i) => {
      const d = Math.round((i.due - today) / DAY);
      return `• ${i.title}: ${d < 0 ? "overdue" : d === 0 ? "due today" : d === 1 ? "due tomorrow" : `due in ${d} days`}`;
    }),
  ];
  return {
    title: overdue.length ? "Kwenta: payment overdue ⚠️" : due.length ? "Kwenta: payment due soon" : "Kwenta: statement ready",
    body: lines.slice(0, 4).join("\n") + (lines.length > 4 ? `\n+${lines.length - 4} more` : ""),
  };
}

const ICON = { icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" };

async function remind() {
  const data = await readData();
  if (!data) return;
  const today = startOfDay(Date.now());
  // Only one round of reminders per day.
  const cache = await caches.open(DATA_CACHE);
  const last = await cache.match("/__kwenta-last-notified");
  if (last && Number(await last.text()) === today) return;

  const n = dueNotification(data, today);
  if (n) await self.registration.showNotification(n.title, { ...ICON, body: n.body, tag: "kwenta-due" });
  if (data.logNudge && data.lastLog && startOfDay(data.lastLog) < today && new Date().getHours() >= 17) {
    await self.registration.showNotification("Alki misses you 🪙", {
      body: "Nothing logged today yet. Takes 5 seconds: tell me what you spent!",
      ...ICON,
      tag: "kwenta-log",
    });
  }
  await cache.put("/__kwenta-last-notified", new Response(String(today)));
}

// A push from the server carries no content: it only wakes the phone. What to say comes from the list the app saved
// on this phone, so the server never learns what is due. Browsers (iPhone especially) require every push to show a
// notification, so there is always a fallback. Using the same tag replaces a notification already showing instead
// of doubling it up (e.g. when background sync already notified).
self.addEventListener("push", (e) => {
  e.waitUntil(
    (async () => {
      const data = await readData().catch(() => null);
      const n = data ? dueNotification(data, startOfDay(Date.now())) : null;
      await self.registration.showNotification(n ? n.title : "Kwenta reminder", {
        ...ICON,
        body: n ? n.body : "Open Kwenta to see what’s coming up.",
        tag: "kwenta-due",
      });
    })(),
  );
});

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "kwenta-reminders") e.waitUntil(remind());
});

// Tapping a notification opens Kwenta (or brings it to the front).
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === location.origin);
      return open ? open.focus() : self.clients.openWindow("/");
    }),
  );
});
