const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

async function getActiveTokensForUser(userId) {
  const snapshot = await db.collection("profiles").doc(userId).collection("devices").where("active", "==", true).get();
  const tokens = [];
  snapshot.forEach((doc) => {
    const token = doc.data().token;
    if (typeof token === "string" && token.length > 0) tokens.push(token);
  });
  return tokens;
}

async function sendToUserDevices(userId, title, body, data = {}) {
  const tokens = await getActiveTokensForUser(userId);
  if (tokens.length === 0) return { sent: 0, failed: 0, reason: "no-active-tokens" };

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
  });

  return {
    sent: response.successCount,
    failed: response.failureCount
  };
}

exports.sendTestNotification = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in to send a test notification.");
  }

  const result = await sendToUserDevices(
    request.auth.uid,
    "NestEggs Test Alert",
    "Notifications are now connected.",
    { type: "test", at: Date.now() }
  );

  return { ok: true, ...result };
});

exports.processNotificationQueue = onDocumentCreated(
  { document: "profiles/{userId}/notificationsQueue/{notificationId}", region: "us-central1" },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const { userId, notificationId } = event.params;
    const payload = snapshot.data() || {};
    const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "NestEggs Alert";
    const body =
      typeof payload.body === "string" && payload.body.trim() ? payload.body.trim() : "You have a new household update.";

    const result = await sendToUserDevices(userId, title, body, {
      type: "queue",
      notificationId
    });

    await snapshot.ref.set(
      {
        status: result.sent > 0 ? "sent" : "failed",
        sentCount: result.sent,
        failedCount: result.failed,
        processedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }
);
