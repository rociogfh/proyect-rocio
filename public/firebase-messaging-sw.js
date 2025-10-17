// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIza...REAL",
  authDomain: "awp-proyect.firebaseapp.com",
  projectId: "awp-proyect",
  messagingSenderId: "352344951263",
  appId: "1:352344951263:web:6792029092b3e1e7a69c6a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title = "Notificación", body = "", icon = "/icon-192.png" } =
    (payload && payload.notification) || {};
  self.registration.showNotification(title, { body, icon });
});
