// firebase-routes.js — Central route database service (modular SDK)
// Depends on: firebase-config.js, firebase-auth.js

'use strict';

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db, auth } from './firebase-config.js';

// ── Grade normalization ────────────────────────────────────────────────────
// Must match GradeSystem.swift and grades.js exactly (36 grades each)
const FRENCH = ['3b','3c','4a','4b','4c','5a','5b','5b+','5c','5c+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c','9c+','10a','10b'];
const YDS    = ['5.3','5.4','5.5','5.6','5.7','5.8','5.9','5.9+','5.10a','5.10a+','5.10b','5.10c','5.10d','5.11a','5.11b','5.11c','5.11d','5.12a','5.12b','5.12c','5.12d','5.13a','5.13b','5.13c','5.13d','5.14a','5.14b','5.14c','5.14d','5.15a','5.15b','5.15c','5.15d','5.16a','5.16b','5.16c'];
const UIAA   = ['3','3+','4-','4','4+','5','6-','6-/6','6','6/6+','6+','7-','7','7+','8-','8','8+','9-','9','9+','10-','10','10+','11-','11','11+','12-','12','12+','13-','13','13+','14-','14','14+','15-'];
const SYSTEM_ARRAYS = { French: FRENCH, YDS, UIAA };

function detectRouteGradeSystem(grade) {
  if (!grade) return 'French';
  for (const [system, arr] of Object.entries(SYSTEM_ARRAYS)) {
    if (arr.includes(grade)) return system;
  }
  return 'French';
}

function normalizeToFrench(grade) {
  const system = detectRouteGradeSystem(grade);
  if (system === 'French') return grade;
  const source = SYSTEM_ARRAYS[system];
  const idx = source.indexOf(grade);
  if (idx === -1) return FRENCH[0];
  return FRENCH[Math.min(idx, FRENCH.length - 1)];
}

export function convertFromFrench(frenchGrade, targetSystem) {
  if (!targetSystem || targetSystem === 'French') return frenchGrade;
  const target = SYSTEM_ARRAYS[targetSystem];
  if (!target) return frenchGrade;
  const idx = FRENCH.indexOf(frenchGrade);
  if (idx === -1) return frenchGrade;
  return target[Math.min(idx, target.length - 1)];
}

function foldedForSearch(str) {
  return (str || '').toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ── Firestore search ───────────────────────────────────────────────────────

export async function searchRoutes(namePrefix, cragFilter = null, displaySystem = 'French', maxResults = 20) {
  const normalized     = foldedForSearch(namePrefix);
  const normalizedCrag = foldedForSearch(cragFilter);

  // Mirror iOS RouteRepository.search(): require >= 2 chars in name OR crag
  if (normalized.length < 2 && normalizedCrag.length < 2) return [];

  let snapshot;

  if (normalized.length < 2) {
    // Crag-only: Firestore can't do substring (contains) search natively,
    // so fetch a broad ordered batch and filter client-side with includes().
    // This matches the UX intent: typing "gou" finds "Les Gours Noirs",
    // "pal" finds "Sector Pal", "face" finds "La Face", etc.
    snapshot = await getDocs(query(
      collection(db, 'routes'),
      orderBy('cragSearch'),
      limit(200),
    ));
  } else {
    // Name prefix path: Firestore prefix query on nameSearch
    snapshot = await getDocs(query(
      collection(db, 'routes'),
      where('nameSearch', '>=', normalized),
      where('nameSearch', '<',  normalized + '\uf8ff'),
      limit(maxResults),
    ));
  }

  let routes = snapshot.docs.map(routeDoc => {
    const d = routeDoc.data();
    return {
      id:            d.id ?? routeDoc.id,
      name:          d.name ?? '',
      climbingArea:  d.climbingArea ?? '',
      crag:          d.crag ?? '',
      grade:         d.grade ?? '',
      displayGrade:  convertFromFrench(d.grade ?? '', displaySystem),
      createdGrade:  d.createdGrade ?? d.grade ?? '',
      routeType:     d.routeType ?? 'Sport',
      sendCount:      d.sendCount    ?? 0,
      projectCount:   d.projectCount ?? 0,
      attemptCount:   d.attemptCount ?? 0,
      isOrphaned:     d.isOrphaned   ?? false,
      createdBy:      d.createdBy    ?? null,
      ratingSum:      d.ratingSum    ?? 0,
      ratingCount:    d.ratingCount  ?? 0,
      communityRating: (d.ratingCount ?? 0) > 0
        ? (d.ratingSum ?? 0) / (d.ratingCount ?? 0)
        : null,
    };
  });

  // Apply client-side crag contains filter in both paths:
  // - crag-only: the Firestore fetch is unfiltered, so this does all the work
  // - combined:  Firestore filtered by name prefix, crag narrows further
  if (normalizedCrag.length >= 2) {
    routes = routes.filter(r => foldedForSearch(r.crag).includes(normalizedCrag));
  }

  return routes.slice(0, maxResults);
}

export async function createCentralRoute({ name, climbingArea, crag, grade, gradeSystem, routeType }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const id = doc(collection(db, 'routes')).id;
  const french = normalizeToFrench(grade);
  const system = detectRouteGradeSystem(grade);
  const now = serverTimestamp();

  await setDoc(doc(db, 'routes', id), {
    id,
    name,
    climbingArea: climbingArea ?? '',
    crag: crag ?? '',
    grade: french,
    createdGrade: grade,
    createdGradeSystem: gradeSystem ?? system,
    routeType: routeType ?? 'Sport',
    length: null,
    sendCount:   0,
    attemptCount: 0,
    projectCount: 0,
    ratingSum:    0,
    ratingCount:  0,
    createdAt: now,
    updatedAt: now,
    createdBy: user.uid,
    isOrphaned: false,
    orphanedAt: null,
    nameSearch: foldedForSearch(name),
    cragSearch: foldedForSearch(crag ?? ''),
  });

  return id;
}

// ── Counter updates (fire-and-forget) ─────────────────────────────────────

export function incrementSendCount(routeID) {
  updateDoc(doc(db, 'routes', routeID), {
    sendCount: increment(1),
    updatedAt: serverTimestamp(),
  }).catch(err => console.warn('incrementSendCount failed:', err));
}

export function incrementProjectCount(routeID) {
  updateDoc(doc(db, 'routes', routeID), {
    projectCount: increment(1),
    updatedAt: serverTimestamp(),
  }).catch(err => console.warn('incrementProjectCount failed:', err));
}

export function decrementProjectCount(routeID) {
  updateDoc(doc(db, 'routes', routeID), {
    projectCount: increment(-1),
    updatedAt: serverTimestamp(),
  }).catch(err => console.warn('decrementProjectCount failed:', err));
}

export function completedProject(routeID) {
  updateDoc(doc(db, 'routes', routeID), {
    projectCount: increment(-1),
    sendCount:    increment(1),
    updatedAt:    serverTimestamp(),
  }).catch(err => console.warn('completedProject counters failed:', err));
}

// ── Community rating ────────────────────────────────────────────────────────

/**
 * Compute the increment deltas needed to update ratingSum / ratingCount.
 * Returns null when no write is needed (no-op case).
 * Mirrors RouteRepository.ratingDeltas(newRating:previousRating:) in iOS.
 */
export function ratingDeltas(newRating, previousRating) {
  const n = newRating      ?? 0;
  const p = previousRating ?? 0;
  if (n === p) return null;                              // unchanged — no-op

  if (p === 0 && n > 0) return { sumDelta: n,     countDelta:  1 };  // first rating
  if (n === 0 && p > 0) return { sumDelta: -p,    countDelta: -1 };  // rating removed
  return                        { sumDelta: n - p, countDelta:  0 };  // changed
}

/**
 * Report a rating change to the central route document.
 * Fire-and-forget — never throws or blocks the caller.
 * Mirrors RouteRepository.reportRating(routeID:newRating:previousRating:) in iOS.
 */
export function reportRating(routeID, newRating, previousRating) {
  const deltas = ratingDeltas(newRating, previousRating);
  if (!deltas) return;

  const fields = { updatedAt: serverTimestamp() };
  if (deltas.sumDelta   !== 0) fields.ratingSum   = increment(deltas.sumDelta);
  if (deltas.countDelta !== 0) fields.ratingCount = increment(deltas.countDelta);

  updateDoc(doc(db, 'routes', routeID), fields)
    .catch(err => console.warn('reportRating failed:', err));
}

// ── Owner update ───────────────────────────────────────────────────────────

export function updateCentralRoute(routeID, { name, climbingArea, crag, grade, gradeSystem, routeType }) {
  const uid    = auth.currentUser?.uid ?? 'unknown';
  const french = normalizeToFrench(grade);
  const ref    = doc(db, 'routes', routeID);
  runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const prev = snap.data().recentEdits ?? [];
    const next = [{ editedAt: new Date(), editedBy: uid }, ...prev].slice(0, 3);
    tx.update(ref, {
      name,
      climbingArea:       climbingArea ?? '',
      crag:               crag ?? '',
      grade:              french,
      createdGrade:       grade,
      createdGradeSystem: gradeSystem ?? detectRouteGradeSystem(grade),
      routeType:          routeType ?? 'Sport',
      nameSearch:         foldedForSearch(name),
      cragSearch:         foldedForSearch(crag ?? ''),
      updatedBy:          uid,
      updatedAt:          serverTimestamp(),
      recentEdits:        next,
    });
  }).catch(err => console.warn('updateCentralRoute failed:', err));
}

// ── Admin ──────────────────────────────────────────────────────────────────

let _adminStatusCache = null; // null = unknown, true/false = resolved

export async function checkAdminStatus() {
  if (_adminStatusCache !== null) return _adminStatusCache;
  const user = auth.currentUser;
  if (!user) { _adminStatusCache = false; return false; }
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    _adminStatusCache = adminSnap.exists();
  } catch {
    _adminStatusCache = false;
  }
  return _adminStatusCache;
}

export async function adminSaveRoute(routeID, { name, climbingArea, crag, grade, gradeSystem, routeType, createdBy, isOrphaned }) {
  const uid    = auth.currentUser?.uid ?? 'unknown';
  const french = normalizeToFrench(grade);
  const ref    = doc(db, 'routes', routeID);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Route not found');
    const data = snap.data();
    const prev = data.recentEdits ?? [];
    const next = [{ editedAt: new Date(), editedBy: uid }, ...prev].slice(0, 3);

    const fields = {
      name,
      climbingArea:       climbingArea ?? '',
      crag:               crag ?? '',
      grade:              french,
      createdGrade:       grade,
      createdGradeSystem: gradeSystem ?? detectRouteGradeSystem(grade),
      routeType:          routeType ?? 'Sport',
      nameSearch:         foldedForSearch(name),
      cragSearch:         foldedForSearch(crag ?? ''),
      createdBy,
      isOrphaned:         isOrphaned ?? false,
      orphanedAt:         isOrphaned ? new Date() : null,
      updatedBy:          uid,
      updatedAt:          serverTimestamp(),
      recentEdits:        next,
    };

    if (createdBy && createdBy !== data.createdBy) {
      fields.lastOwnershipTransfer = {
        fromUID:       data.createdBy ?? null,
        toUID:         createdBy,
        transferredBy: uid,
        transferredAt: new Date(),
      };
    }

    tx.update(ref, fields);
  });
}

export async function adminDeleteRoute(routeID) {
  await deleteDoc(doc(db, 'routes', routeID));
}

export async function getRoute(routeID) {
  const snap = await getDoc(doc(db, 'routes', routeID));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id:                    d.id ?? snap.id,
    name:                  d.name ?? '',
    climbingArea:          d.climbingArea ?? '',
    crag:                  d.crag ?? '',
    grade:                 d.grade ?? '',
    createdGrade:          d.createdGrade ?? d.grade ?? '',
    createdGradeSystem:    d.createdGradeSystem ?? 'French',
    routeType:             d.routeType ?? 'Sport',
    sendCount:       d.sendCount    ?? 0,
    projectCount:    d.projectCount ?? 0,
    isOrphaned:      d.isOrphaned   ?? false,
    ratingSum:       d.ratingSum    ?? 0,
    ratingCount:     d.ratingCount  ?? 0,
    communityRating: (d.ratingCount ?? 0) > 0
      ? (d.ratingSum ?? 0) / (d.ratingCount ?? 0)
      : null,
    createdBy:             d.createdBy ?? null,
    updatedBy:             d.updatedBy ?? null,
    updatedAt:             d.updatedAt?.toDate() ?? null,
    recentEdits: (d.recentEdits ?? []).map(e => ({
      editedAt: e.editedAt?.toDate ? e.editedAt.toDate() : new Date(e.editedAt),
      editedBy: e.editedBy,
    })),
    lastOwnershipTransfer: d.lastOwnershipTransfer ? {
      fromUID:       d.lastOwnershipTransfer.fromUID ?? null,
      toUID:         d.lastOwnershipTransfer.toUID ?? null,
      transferredBy: d.lastOwnershipTransfer.transferredBy ?? null,
      transferredAt: d.lastOwnershipTransfer.transferredAt?.toDate
        ? d.lastOwnershipTransfer.transferredAt.toDate()
        : new Date(d.lastOwnershipTransfer.transferredAt),
    } : null,
  };
}

// ── Soft link drift detection ──────────────────────────────────────────────

export function shouldClearSoftLink(original, current) {
  return original.name !== current.name
      || original.crag !== current.crag
      || original.area !== current.area;
}

// ── Admin stats helpers (used by admin.js) ────────────────────────────────
// Re-export Firestore primitives needed by admin.js for count queries
export { collection, collectionGroup, query, where, getDocs };
