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

function computeTrainingStats(sessions, period = 'allTime') {
  const now = new Date();
  const filtered = sessions.filter(s => {
    if (!s.date || period === 'allTime') return true;
    const d = s.date;
    if (period === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (period === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === 'year') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const totalSessions = filtered.length;
  const totalMinutes = filtered.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  const daySet = new Set(filtered.map(s => s.date ? s.date.toDateString() : null).filter(Boolean));
  const trainingDays = daySet.size;
  const byType = {};
  filtered.forEach(s => { byType[s.type] = (byType[s.type] ?? 0) + 1; });

  const weeks = period === 'week' ? 1
    : period === 'month' ? 4
    : period === 'year' ? 52
    : Math.max(1, Math.ceil(
        (now - (filtered.at(-1)?.date ?? now)) / (7 * 24 * 60 * 60 * 1000)
      ));
  const avgPerWeek = totalSessions / weeks;

  function formattedTotalTime(mins) {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  return { totalSessions, totalMinutes, trainingDays, byType, avgPerWeek, formattedTotalTime };
}
