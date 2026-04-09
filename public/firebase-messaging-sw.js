/* global importScripts, firebase */
importScripts("/__/firebase/11.0.2/firebase-app-compat.js");
importScripts("/__/firebase/11.0.2/firebase-messaging-compat.js");
importScripts("/__/firebase/init.js");

if (typeof firebase !== "undefined" && firebase.messaging) {
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || "NestEggs Alert";
    const notificationOptions = {
      body: payload.notification?.body || "You have a new household update.",
      icon: "/icon-192.svg",
      data: payload.data || {}
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}
