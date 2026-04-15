// firebase-routes.js — Central route database service
// Depends on: firebase-config.js (sets window.db, window.auth)
// Mirrors the pattern of firebase-climbs.js

'use strict';

// ── Grade normalization ────────────────────────────────────────────────────
// Must match GradeSystem.swift and grades.js exactly (36 grades each)
const FRENCH = ['3b','3c','4a','4b','4c','5a','5b','5b+','5c','5c+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c','9c+','10a','10b'];
const YDS    = ['5.3','5.4','5.5','5.6','5.7','5.8','5.9','5.9+','5.10a','5.10a+','5.10b','5.10c','5.10d','5.11a','5.11b','5.11c','5.11d','5.12a','5.12b','5.12c','5.12d','5.13a','5.13b','5.13c','5.13d','5.14a','5.14b','5.14c','5.14d','5.15a','5.15b','5.15c','5.15d','5.16a','5.16b','5.16c'];
const UIAA   = ['3','3+','4-','4','4+','5','6-','6-/6','6','6/6+','6+','7-','7','7+','8-','8','8+','9-','9','9+','10-','10','10+','11-','11','11+','12-','12','12+','13-','13','13+','14-','14','14+','15-'];
const SYSTEM_ARRAYS = { French: FRENCH, YDS, UIAA };

/**
 * Detect which grade system a grade string belongs to.
 * Returns 'French' as fallback.
 */
function detectRouteGradeSystem(grade) {
  if (!grade) return 'French';
  for (const [system, arr] of Object.entries(SYSTEM_ARRAYS)) {
    if (arr.includes(grade)) return system;
  }
  return 'French';
}

/**
 * Normalize a grade to French using aligned index mapping.
 * Returns the first French grade as fallback for unrecognized grades.
 */
function normalizeToFrench(grade) {
  const system = detectRouteGradeSystem(grade);
  if (system === 'French') return grade;
  const source = SYSTEM_ARRAYS[system];
  const idx = source.indexOf(grade);
  if (idx === -1) return FRENCH[0];
  return FRENCH[Math.min(idx, FRENCH.length - 1)];
}

/**
 * Convert a French grade to any target system using aligned index mapping.
 * Returns the French grade unchanged if system is 'French'.
 */
function convertFromFrench(frenchGrade, targetSystem) {
  if (!targetSystem || targetSystem === 'French') return frenchGrade;
  const target = SYSTEM_ARRAYS[targetSystem];
  if (!target) return frenchGrade;
  const idx = FRENCH.indexOf(frenchGrade);
  if (idx === -1) return frenchGrade;
  return target[Math.min(idx, target.length - 1)];
}

/**
 * Strip diacritics and lowercase for Firestore prefix search.
 * Matches String.foldedForSearch() in iOS.
 */
function foldedForSearch(str) {
  return (str || '').toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ── Firestore search ───────────────────────────────────────────────────────

/**
 * Search central routes by name prefix with optional crag filter.
 * Returns routes with grade converted to the user's preferred system.
 * @param {string} namePrefix - at least 2 chars
 * @param {string|null} cragFilter - optional crag filter (exact cragSearch match)
 * @param {string} displaySystem - 'French' | 'YDS' | 'UIAA'
 * @param {number} limit
 * @returns {Promise<Array>} array of route objects
 */
async function searchRoutes(namePrefix, cragFilter = null, displaySystem = 'French', limit = 20) {
  const normalized = foldedForSearch(namePrefix);
  if (normalized.length < 2) return [];

  let query = db.collection('routes')
    .where('nameSearch', '>=', normalized)
    .where('nameSearch', '<', normalized + '\uf8ff')
    .limit(limit);

  if (cragFilter && cragFilter.trim()) {
    query = query.where('cragSearch', '==', foldedForSearch(cragFilter));
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      id:            d.id ?? doc.id,
      name:          d.name ?? '',
      climbingArea:  d.climbingArea ?? '',
      crag:          d.crag ?? '',
      grade:         d.grade ?? '',         // French canonical
      displayGrade:  convertFromFrench(d.grade ?? '', displaySystem),
      createdGrade:  d.createdGrade ?? d.grade ?? '',
      routeType:     d.routeType ?? 'Sport',
      sendCount:     d.sendCount ?? 0,
      projectCount:  d.projectCount ?? 0,
      attemptCount:  d.attemptCount ?? 0,
      isOrphaned:    d.isOrphaned ?? false,
    };
  });
}

/**
 * Create a new central route document.
 * Sets createdBy to the current user's UID.
 */
async function createCentralRoute({ name, climbingArea, crag, grade, gradeSystem, routeType }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const id = db.collection('routes').doc().id;
  const french = normalizeToFrench(grade);
  const system = detectRouteGradeSystem(grade);
  const now = firebase.firestore.FieldValue.serverTimestamp();

  await db.collection('routes').doc(id).set({
    id,
    name,
    climbingArea: climbingArea ?? '',
    crag: crag ?? '',
    grade: french,
    createdGrade: grade,
    createdGradeSystem: gradeSystem ?? system,
    routeType: routeType ?? 'Sport',
    length: null,
    sendCount: 0,
    attemptCount: 0,
    projectCount: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: user.uid,      // never displayed in UI
    isOrphaned: false,
    orphanedAt: null,
    nameSearch: foldedForSearch(name),
    cragSearch: foldedForSearch(crag ?? ''),
  });

  return id;
}

// ── Counter updates (fire-and-forget) ─────────────────────────────────────

function incrementSendCount(routeID) {
  db.collection('routes').doc(routeID).update({
    sendCount: firebase.firestore.FieldValue.increment(1),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(err => console.warn('incrementSendCount failed:', err));
}

function incrementProjectCount(routeID) {
  db.collection('routes').doc(routeID).update({
    projectCount: firebase.firestore.FieldValue.increment(1),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(err => console.warn('incrementProjectCount failed:', err));
}

function decrementProjectCount(routeID) {
  db.collection('routes').doc(routeID).update({
    projectCount: firebase.firestore.FieldValue.increment(-1),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(err => console.warn('decrementProjectCount failed:', err));
}

function completedProject(routeID) {
  db.collection('routes').doc(routeID).update({
    projectCount: firebase.firestore.FieldValue.increment(-1),
    sendCount: firebase.firestore.FieldValue.increment(1),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(err => console.warn('completedProject counters failed:', err));
}

// ── Soft link drift detection ──────────────────────────────────────────────

/**
 * Returns true if identity fields (name, crag, area) have changed from the
 * central route — meaning centralRouteID should be cleared.
 */
function shouldClearSoftLink(original, current) {
  return original.name !== current.name
      || original.crag !== current.crag
      || original.area !== current.area;
}
