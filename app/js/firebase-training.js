// firebase-training.js — Firestore implementation replacing training.js
// Exposes same interface as training.js
// Depends on: firebase-config.js (sets window.db), firebase-auth.js

const TRAINING_TYPES = [
  'Hangboard', 'Campus Board', 'System Wall',
  'Gym Session', 'Yoga', 'Cardio', 'Other'
];

const TYPE_EMOJI = {
  'Hangboard':    '🏋️',
  'Campus Board': '🪜',
  'System Wall':  '🧩',
  'Gym Session':  '🧗',
  'Yoga':         '🧘',
  'Cardio':       '🏃',
  'Other':        '⚡',
};

async function fetchTrainingSessions() {
  const user = getCurrentUser();
  if (!user) return [];
  const snapshot = await db
    .collection(`users/${user.uid}/trainingSessions`)
    .orderBy('date', 'desc')
    .get();
  return snapshot.docs
    .filter(doc => !doc.data().deletedAt)
    .map(doc => {
      const d = doc.data();
      return {
        recordName: doc.id,
        id:         d.id ?? doc.id,
        date:       d.date?.toDate() ?? null,
        type:       d.type ?? 'Gym Session',
        duration:   d.duration ?? 60,
        intensity:  d.intensity ?? 3,
        notes:      d.notes ?? null,
      };
    });
}

async function saveTrainingSession(session) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not signed in');
  const id = session.id ?? session.recordName ?? crypto.randomUUID();
  const doc = {
    id,
    type:      session.type ?? 'Gym Session',
    duration:  session.duration ?? 60,
    intensity: session.intensity ?? 3,
    notes:     session.notes ?? '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (session.date) doc.date = firebase.firestore.Timestamp.fromDate(new Date(session.date));
  await db.doc(`users/${user.uid}/trainingSessions/${id}`).set(doc, { merge: true });
  return id;
}

async function deleteTrainingSession(id) {
  const user = getCurrentUser();
  if (!user) return;
  const ts = firebase.firestore.FieldValue.serverTimestamp();
  await db.doc(`users/${user.uid}/trainingSessions/${id}`).update({
    deletedAt: ts,
    updatedAt: ts,
  });
}

function computeTrainingStats(sessions, period = 'all') {
  const now = new Date();
  let filtered = sessions;
  if (period === 'month') {
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    filtered = sessions.filter(s => s.date && s.date >= cutoff);
  } else if (period === 'year') {
    filtered = sessions.filter(s => s.date && s.date.getFullYear() === now.getFullYear());
  }
  const byType = {};
  filtered.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1; });
  const totalMinutes = filtered.reduce((sum, s) => sum + (s.duration || 0), 0);
  return { total: filtered.length, byType, totalMinutes };
}
