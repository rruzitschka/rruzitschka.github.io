// firebase-climbs.js — Firestore implementation replacing climbs.js
// Exposes same interface as climbs.js
// Depends on: firebase-config.js (sets window.db), firebase-auth.js

// recordName for ascents is encoded as "noteId/ascentId" so deleteAscent
// can reconstruct the Firestore sub-collection path without a noteId parameter.

// iOS stores sendType as lowercase; web UI expects Title Case
const SEND_TYPE_NORMALIZE = {
  'redpoint':  'Redpoint',
  'onsight':   'On Sight',
  'on sight':  'On Sight',
  'flash':     'Flash',
  'project':   'Project',
  'pinkpoint': 'Pinkpoint',
};
function normalizeSendType(raw) {
  return SEND_TYPE_NORMALIZE[raw?.toLowerCase()] ?? raw ?? 'Redpoint';
}

async function fetchClimbs() {
  const user = getCurrentUser();
  if (!user) return [];
  const snapshot = await db
    .collection(`users/${user.uid}/climbNotes`)
    .orderBy('date', 'desc')
    .get();

  const notes = await Promise.all(
    snapshot.docs
      .filter(doc => !doc.data().deletedAt)
      .map(async doc => {
        const d = doc.data();
        const ascSnap = await db
          .collection(`users/${user.uid}/climbNotes/${doc.id}/ascents`)
          .orderBy('date', 'desc')
          .get();
        const ascents = ascSnap.docs
          .filter(a => !a.data().deletedAt)
          .map(a => {
            const ad = a.data();
            return {
              recordName: `${doc.id}/${a.id}`,  // composite: noteId/ascentId
              id:       ad.id ?? a.id,
              date:     ad.date?.toDate() ?? null,
              sendType: normalizeSendType(ad.sendType),
              notes:    ad.notes ?? null,
            };
          });
        // Normalize sendType: iOS stores lowercase, web expects Title Case
        const sendType = normalizeSendType(d.sendType);
        const isProject = sendType === 'Project';
        return {
          recordName:    doc.id,
          id:            d.id ?? doc.id,
          route:         d.route ?? '',
          climbingArea:  d.climbingArea ?? '',
          crag:          d.crag ?? '',
          difficulty:    d.difficulty ?? '',
          sendType,
          isProject,
          routeType:     d.routeType ?? 'Sport',
          noteText:      d.noteText ?? '',
          rating:        d.rating ?? 0,
          attemptCount:  d.attemptCount ?? 0,
          date:          d.date?.toDate() ?? null,
          lastAttemptDate: d.lastAttemptDate?.toDate() ?? null,
          projectStatus: d.projectStatus ?? null,
          projectNotes:  d.projectNotes ?? null,
          highPoint:     d.highPoint ?? null,
          ascents,
        };
      })
  );
  return notes;
}

async function saveClimbNote(note) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not signed in');
  const id = note.id ?? note.recordName ?? crypto.randomUUID();
  const doc = {
    id,
    route:        note.route ?? '',
    climbingArea: note.climbingArea ?? '',
    crag:         note.crag ?? '',
    difficulty:   note.difficulty ?? '',
    sendType:     note.sendType ?? 'redpoint',
    routeType:    note.routeType ?? 'Sport',
    noteText:     note.noteText ?? '',
    rating:       note.rating ?? 0,
    attemptCount: note.attemptCount ?? 0,
    updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (note.date)            doc.date = firebase.firestore.Timestamp.fromDate(new Date(note.date));
  if (note.lastAttemptDate) doc.lastAttemptDate = firebase.firestore.Timestamp.fromDate(new Date(note.lastAttemptDate));
  if (note.projectStatus)   doc.projectStatus = note.projectStatus;
  if (note.projectNotes)    doc.projectNotes = note.projectNotes;
  if (note.highPoint)       doc.highPoint = note.highPoint;
  await db.doc(`users/${user.uid}/climbNotes/${id}`).set(doc, { merge: true });
  return id;
}

async function deleteClimbNote(id) {
  const user = getCurrentUser();
  if (!user) return;
  const ts = firebase.firestore.FieldValue.serverTimestamp();
  await db.doc(`users/${user.uid}/climbNotes/${id}`).update({
    deletedAt: ts,
    updatedAt: ts,
  });
}

async function saveAscent(ascent) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not signed in');
  const noteId = ascent.climbNoteRecordName ?? ascent.noteId;
  const id = ascent.id ?? crypto.randomUUID();
  await db.doc(`users/${user.uid}/climbNotes/${noteId}/ascents/${id}`).set({
    id,
    sendType: ascent.sendType ?? 'redpoint',
    notes:    ascent.notes ?? '',
    date:     ascent.date ? firebase.firestore.Timestamp.fromDate(new Date(ascent.date)) : firebase.firestore.Timestamp.now(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return id;
}

async function deleteAscent(compositeId) {
  // compositeId is "noteId/ascentId" — encoded in fetchClimbs recordName
  const user = getCurrentUser();
  if (!user) return;
  const [noteId, ascentId] = compositeId.split('/');
  if (!noteId || !ascentId) { console.warn('deleteAscent: bad compositeId', compositeId); return; }
  const ts = firebase.firestore.FieldValue.serverTimestamp();
  await db.doc(`users/${user.uid}/climbNotes/${noteId}/ascents/${ascentId}`).update({
    deletedAt: ts,
    updatedAt: ts,
  });
}

function computeStats(climbs) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const byType = {};
  climbs.filter(c => !c.isProject).forEach(c => {
    byType[c.sendType] = (byType[c.sendType] || 0) + 1;
  });
  return {
    total:    climbs.filter(c => !c.isProject).length,
    thisYear: climbs.filter(c => c.date && c.date.getFullYear() === thisYear).length,
    byType,
    projects: climbs.filter(c => c.isProject).length,
  };
}

function filterClimbs(climbs, { area, year, sendType, routeType, search, sort } = {}) {
  let result = [...climbs];
  if (area)      result = result.filter(c => c.climbingArea === area);
  if (year)      result = result.filter(c => c.date && c.date.getFullYear() === parseInt(year));
  if (sendType)  result = result.filter(c => c.sendType === sendType);
  if (routeType) result = result.filter(c => c.routeType === routeType);
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(c =>
      c.route?.toLowerCase().includes(q) ||
      c.climbingArea?.toLowerCase().includes(q) ||
      c.crag?.toLowerCase().includes(q)
    );
  }
  if (sort === 'grade') result.sort((a, b) => (b.difficulty || '').localeCompare(a.difficulty || ''));
  else result.sort((a, b) => (b.date || 0) - (a.date || 0));
  return result;
}
