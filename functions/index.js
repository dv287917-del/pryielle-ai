// OPTIONAL: push notifications when the app is closed. Needs Firebase Blaze plan.
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

exports.notifyMessage = onDocumentCreated("chats/{chatId}/messages/{msgId}", async (event) => {
  const m = event.data && event.data.data();
  if (!m || m.system) return;
  const db = getFirestore();
  const chatId = event.params.chatId;
  const chat = (await db.doc(`chats/${chatId}`).get()).data();
  if (!chat) return;

  const tokens = [];
  for (const uid of chat.members.filter((u) => u !== m.senderId)) {
    const u = (await db.doc(`users/${uid}`).get()).data();
    if (!u || (u.muted || []).includes(chatId) || (u.blocked || []).includes(m.senderId)) continue;
    tokens.push(...(u.fcmTokens || []));
  }
  if (!tokens.length) return;

  const body = m.text || (m.image ? "📷 Photo" : m.audio ? "🎤 Voice message" : "GIF");
  await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: chat.kind === "group" ? `${m.senderName} · ${chat.title}` : m.senderName, body },
    data: { chatId },
    android: { priority: "high" },
  });
});

// ---- v2.3: push the OWNER when a signup request or a bad-behaviour alert arrives (works even when the app is closed) ----
const { onDocumentCreated: onCreate } = require("firebase-functions/v2/firestore");

async function ownerTokens(db) {
  const snap = await db.collection("users").where("role", "==", "owner").limit(3).get();
  return snap.docs.flatMap((d) => d.data().fcmTokens || []);
}

exports.notifyOwnerSignup = onCreate("users/{uid}", async (event) => {
  const u = event.data && event.data.data();
  if (!u || u.approval !== "pending") return;
  const tokens = await ownerTokens(getFirestore());
  if (!tokens.length) return;
  await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: "🆕 Nayi signup request", body: `${u.displayName} (@${u.username}) andar aana chahta hai` },
    android: { priority: "high" },
  });
});

exports.notifyOwnerAlert = onCreate("alerts/{id}", async (event) => {
  const a = event.data && event.data.data();
  if (!a) return;
  const tokens = await ownerTokens(getFirestore());
  if (!tokens.length) return;
  await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: `⚠️ ${String(a.kind).toUpperCase()}: ${a.senderName}`, body: String(a.text || "").slice(0, 120) },
    android: { priority: "high" },
  });
});

// ---- v2.7: Emergency alarm. Admin alarm bhejta hai -> user ke phone par data push -> AlarmService bajata hai (app band ho tab bhi, force-stop ko chhod ke) ----
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
exports.notifyAlarm = onDocumentWritten("alarms/{uid}", async (event) => {
  const a = event.data && event.data.after && event.data.after.data();
  if (!a || a.ack) return;
  const before = event.data.before && event.data.before.data();
  if (before && before.id === a.id) return; // sirf naya alarm
  const u = (await getFirestore().doc(`users/${event.params.uid}`).get()).data();
  const tokens = (u && u.fcmTokens) || [];
  if (!tokens.length) return;
  await getMessaging().sendEachForMulticast({
    tokens,
    data: { type: "alarm", id: String(a.id), seconds: String(a.seconds || 30) },
    android: { priority: "high", ttl: 600000 },
  });
});

// Pryielle AI moved to Vercel /api/ai. Do not export the old Firebase AI triggers.
