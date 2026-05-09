// mock.js — ES module exporting mock implementations for all Firebase service functions
// Usage: imported dynamically by the init script when ?mock=true
// All exported functions match the signatures of the real firebase-* modules.

// ── Mock user ──────────────────────────────────────────────────────────────

const MOCK_USER = {
  uid:         'mock-user-001',
  displayName: 'Alex Climber',
  email:       'alex@example.com',
  getIdToken:  async () => 'mock-id-token',
};

// ── Auth ───────────────────────────────────────────────────────────────────

export function initAuth() {
  return Promise.resolve(MOCK_USER);
}

export function signInWithApple() {
  return Promise.resolve(MOCK_USER);
}

export function signOut() {
  window.location.reload();
  return Promise.resolve();
}

export function getCurrentUser() {
  return MOCK_USER;
}

export function deleteAccount() {
  return Promise.resolve();
}

// ── Climbs ─────────────────────────────────────────────────────────────────

export async function fetchClimbs() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('empty') === '1') return [];
  return [...MOCK_CLIMBS];
}

export async function saveClimbNote(climbData) {
  const isNew = !climbData.recordName;
  const rn = climbData.recordName ?? ('mock-cn-new-' + Date.now());
  const saved = {
    ...climbData,
    recordName: rn,
    id:         climbData.id ?? crypto.randomUUID(),
    isProject:  climbData.sendType === 'Project',
    ascents:    climbData.ascents ?? [],
  };
  if (isNew) {
    MOCK_CLIMBS.unshift(saved);
  } else {
    const idx = MOCK_CLIMBS.findIndex(c => c.recordName === rn);
    if (idx !== -1) MOCK_CLIMBS[idx] = saved;
  }
  console.log('[Mock] saved ClimbNote', rn);
  return rn;
}

export async function deleteClimbNote(recordName) {
  const idx = MOCK_CLIMBS.findIndex(c => c.recordName === recordName);
  if (idx !== -1) MOCK_CLIMBS[idx] = { ...MOCK_CLIMBS[idx], deletedAt: new Date() };
  console.log('[Mock] deleted ClimbNote', recordName);
}

export async function saveAscent(ascentData) {
  const rn = ascentData.recordName ?? ('mock-asc-' + Date.now());
  console.log('[Mock] saved Ascent', rn);
  return rn;
}

export async function deleteAscent(recordName) {
  console.log('[Mock] deleted Ascent', recordName);
}

export async function fetchPhotos(noteId) {
  if (noteId === 'mock-1') {
    return [
      {
        id: 'mock-photo-1',
        storageURL: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600&q=80',
        fileName: 'biographie.jpg',
      },
    ];
  }
  return [];
}

export { computeStats, filterClimbs } from './firebase-climbs.js';

// ── Training ───────────────────────────────────────────────────────────────

export async function fetchTrainingSessions() {
  return [...MOCK_SESSIONS];
}

export async function saveTrainingSession(session) {
  const isNew = !session.recordName;
  const rn = session.recordName ?? ('mock-ts-new-' + Date.now());
  const saved = { ...session, recordName: rn, id: session.id ?? crypto.randomUUID() };
  if (isNew) {
    MOCK_SESSIONS.unshift(saved);
  } else {
    const idx = MOCK_SESSIONS.findIndex(s => s.recordName === rn);
    if (idx !== -1) MOCK_SESSIONS[idx] = saved;
  }
  console.log('[Mock] saved TrainingSession', rn);
  return rn;
}

export async function deleteTrainingSession(recordName) {
  const idx = MOCK_SESSIONS.findIndex(s => s.recordName === recordName);
  if (idx !== -1) MOCK_SESSIONS.splice(idx, 1);
  console.log('[Mock] deleted TrainingSession', recordName);
}

export { computeTrainingStats } from './firebase-training.js';

// ── API Keys ───────────────────────────────────────────────────────────────

export async function apiKeysList() {
  return MOCK_API_KEYS.map(k => ({ ...k }));
}

export async function apiKeysCreate({ label, scopes }) {
  const id = 'mock-key-' + Date.now();
  const rawKey = 'cnl_mock' + Math.random().toString(36).slice(2, 18).padEnd(16, '0');
  const newKey = { id, label, scopes, createdAt: new Date().toISOString(), lastUsedAt: null };
  MOCK_API_KEYS.unshift(newKey);
  console.log('[Mock] created API key', id);
  return { ...newKey, key: rawKey };
}

export async function apiKeysRevoke(keyId) {
  const idx = MOCK_API_KEYS.findIndex(k => k.id === keyId);
  if (idx !== -1) MOCK_API_KEYS.splice(idx, 1);
  console.log('[Mock] revoked API key', keyId);
}

// ── Routes ────────────────────────────────────────────────────────────────
// Full in-memory implementation — mirrors firebase-routes.js searchRoutes()
// so partial-crag matching and all UI behaviour can be tested without Firestore.

function foldedForSearch(str) {
  return (str || '').toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const FRENCH_MOCK = ['3b','3c','4a','4b','4c','5a','5b','5b+','5c','5c+','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c'];
const YDS_MOCK    = ['5.3','5.4','5.5','5.6','5.7','5.8','5.9','5.9+','5.10a','5.10a+','5.10b','5.10c','5.10d','5.11a','5.11b','5.11c','5.11d','5.12a','5.12b','5.12c','5.12d','5.13a','5.13b','5.13c','5.13d','5.14a','5.14b','5.14c','5.14d','5.15a','5.15b','5.15c','5.15d'];
const UIAA_MOCK   = ['3','3+','4-','4','4+','5','6-','6-/6','6','6/6+','6+','7-','7','7+','8-','8','8+','9-','9','9+','10-','10','10+','11-','11','11+','12-','12','12+','13-','13','13+','14-'];

function mockConvertFromFrench(frenchGrade, targetSystem) {
  if (!targetSystem || targetSystem === 'French') return frenchGrade;
  const target = { YDS: YDS_MOCK, UIAA: UIAA_MOCK }[targetSystem];
  if (!target) return frenchGrade;
  const idx = FRENCH_MOCK.indexOf(frenchGrade);
  if (idx === -1) return frenchGrade;
  return target[Math.min(idx, target.length - 1)];
}

export async function searchRoutes(namePrefix, cragFilter = null, displaySystem = 'French', maxResults = 20) {
  const normalized     = foldedForSearch(namePrefix);
  const normalizedCrag = foldedForSearch(cragFilter);

  // Mirror iOS: require >= 2 chars in name OR crag
  if (normalized.length < 2 && normalizedCrag.length < 2) return [];

  let results;

  if (normalized.length < 2) {
    // Crag-only: contains match (mirrors the real firebase-routes.js client-side filter)
    results = MOCK_ROUTES.filter(r => foldedForSearch(r.crag).includes(normalizedCrag));
  } else {
    // Name prefix match
    results = MOCK_ROUTES.filter(r => foldedForSearch(r.name).startsWith(normalized));
    // Combined: narrow by crag contains
    if (normalizedCrag.length >= 2) {
      results = results.filter(r => foldedForSearch(r.crag).includes(normalizedCrag));
    }
  }

  // Simulate network latency so the spinner is visible
  await new Promise(resolve => setTimeout(resolve, 400));

  return results.slice(0, maxResults).map(r => ({
    ...r,
    displayGrade: mockConvertFromFrench(r.grade, displaySystem),
  }));
}

export async function createCentralRoute({ name, climbingArea, crag, grade, routeType }) {
  const id = 'mock-route-' + Date.now();
  MOCK_ROUTES.push({
    id, name,
    climbingArea: climbingArea ?? '',
    crag: crag ?? '',
    grade: grade ?? '6a',
    displayGrade: grade ?? '6a',
    routeType: routeType ?? 'Sport',
    sendCount: 0,
    projectCount: 0,
    attemptCount: 0,
    isOrphaned: false,
    createdBy: MOCK_USER.uid,
  });
  console.log('[Mock] created central route', id, name);
  return id;
}

export function updateCentralRoute(routeID, fields) {
  const idx = MOCK_ROUTES.findIndex(r => r.id === routeID);
  if (idx !== -1) Object.assign(MOCK_ROUTES[idx], fields);
  console.log('[Mock] updated central route', routeID);
}

export async function checkAdminStatus() { return false; }
export function incrementSendCount() {}
export function incrementProjectCount() {}
export function decrementProjectCount() {}
export function completedProject() {}

// ── Mock banner ────────────────────────────────────────────────────────────

const banner = document.createElement('div');
banner.textContent = '🧪 Mock Mode — test data only';
banner.style.cssText = 'background:#f97316;color:white;text-align:center;padding:6px;font-weight:600;font-size:0.85rem;position:relative;z-index:9999;';
document.body.prepend(banner);

// =============================================================================
// Mock data
// =============================================================================

const MOCK_CLIMBS = [
  {
    recordName: 'mock-1',
    route: 'Biographie', climbingArea: 'Ceüse', crag: 'La Face',
    difficulty: '9a', date: new Date('2026-08-15'), sendType: 'Redpoint',
    rating: 5, noteText: 'Dream route, finally!', routeType: 'Sport',
    attemptCount: 47, isProject: false,
    ascents: [
      { recordName: 'mock-1/asc-1', id: 'asc-1', date: new Date('2026-09-10'), sendType: 'Redpoint', notes: 'Even better second time' },
      { recordName: 'mock-1/asc-2', id: 'asc-2', date: new Date('2026-10-03'), sendType: 'Redpoint', notes: null },
    ]
  },
  { recordName: 'mock-2', route: 'Bat Route', climbingArea: 'Buoux', crag: 'Les Gours Noirs', difficulty: '8c', date: new Date('2026-05-20'), sendType: 'Redpoint', rating: 4, noteText: 'Powerful crimping sequence in the middle crux.', routeType: 'Sport', attemptCount: 12, isProject: false },
  { recordName: 'mock-3', route: 'La Dura Dura', climbingArea: 'Oliana', crag: 'Sector Pal', difficulty: '9a+', date: null, sendType: 'Project', rating: 0, noteText: null, routeType: 'Sport', attemptCount: 23, isProject: true, projectStatus: 'Close', highPoint: 'Third bolt clip', lastAttemptDate: new Date('2026-03-01'), projectNotes: 'Need to work the lower crux more.' },
  { recordName: 'mock-4', route: 'Action Directe', climbingArea: 'Frankenjura', crag: 'Waldkopf', difficulty: '9a', date: null, sendType: 'Project', rating: 0, noteText: null, routeType: 'Sport', attemptCount: 8, isProject: true, projectStatus: 'Working', highPoint: 'Move 4 of 7', lastAttemptDate: new Date('2025-11-10'), projectNotes: null },
  { recordName: 'mock-5', route: 'Hubble', climbingArea: 'Raven Tor', crag: null, difficulty: '8b+', date: null, sendType: 'Project', rating: 0, noteText: null, routeType: 'Sport', attemptCount: 3, isProject: true, projectStatus: 'Working', highPoint: null, lastAttemptDate: null, projectNotes: null },
  { recordName: 'mock-6', route: 'Rotpunkt Classic', climbingArea: 'Frankenjura', crag: 'Bärenschlucht', difficulty: '7c', date: new Date('2024-07-04'), sendType: 'Redpoint', rating: 3, noteText: 'Old school Frankenjura climbing.', routeType: 'Sport', attemptCount: 4, isProject: false },
  { recordName: 'mock-7', route: 'Planta de Shiva', climbingArea: 'Siurana', crag: 'El Pati', difficulty: '7b+', date: new Date('2025-04-12'), sendType: 'On Sight', rating: 5, noteText: 'Perfect onsight conditions.', routeType: 'Sport', attemptCount: 1, isProject: false },
  { recordName: 'mock-8', route: 'Move', climbingArea: 'Magic Wood', crag: 'Hauptwand', difficulty: '7c+', date: new Date('2025-09-03'), sendType: 'Flash', rating: 4, noteText: 'Got the beta from a friend.', routeType: 'Boulder', attemptCount: 1, isProject: false },
  { recordName: 'mock-9', route: 'Le Bombé', climbingArea: 'Fontainebleau', crag: 'Cuvier Rempart', difficulty: '7a', date: new Date('2024-03-18'), sendType: 'Redpoint', rating: 3, noteText: 'Pre-placed gear at the crux.', routeType: 'Sport', attemptCount: 2, isProject: false },
  { recordName: 'mock-10', route: 'La Rose et le Vampire', climbingArea: 'Buoux', crag: 'La Dalle aux Plaques', difficulty: '7c', date: new Date('2024-06-22'), sendType: 'Redpoint', rating: 4, noteText: 'Technical face climbing on small crimps.', routeType: 'Sport', attemptCount: 5, isProject: false },
  { recordName: 'mock-11', route: 'Easy Does It', climbingArea: 'Local Gym', crag: null, difficulty: '6b', date: new Date('2026-01-10'), sendType: 'Flash', rating: 0, noteText: null, routeType: 'Boulder', attemptCount: 1, isProject: false },
  { recordName: 'mock-12', route: 'Dreamtime', climbingArea: 'Cresciano', crag: 'Dreamtime Block', difficulty: '8b', date: new Date('2025-03-25'), sendType: 'Redpoint', rating: 5, noteText: 'Took 30 attempts. Worth every one.', routeType: 'Boulder', attemptCount: 30, isProject: false },
  { recordName: 'mock-13', route: 'Nouveau Monde', climbingArea: 'Ceüse', crag: 'La Face', difficulty: '8c+', date: new Date('2026-02-14'), sendType: 'Redpoint', rating: 4, noteText: "Valentine's Day send.", routeType: 'Sport', attemptCount: 31, isProject: false },
  { recordName: 'mock-14', route: 'Bronx', climbingArea: 'Céüse', crag: 'La Face', difficulty: '8a', date: new Date('2025-11-02'), sendType: 'Redpoint', rating: 4, noteText: 'Great warm-up.', routeType: 'Sport', attemptCount: 7, isProject: false },
  { recordName: 'mock-15', route: 'Golpe de Estado', climbingArea: 'Siurana', crag: 'El Pati', difficulty: '8a', date: new Date('2025-10-15'), sendType: 'On Sight', rating: 5, noteText: 'Incredible onsight!', routeType: 'Sport', attemptCount: 1, isProject: false },
  { recordName: 'mock-16', route: 'Papichulo', climbingArea: 'Oliana', crag: 'Sector Pal', difficulty: '8c', date: new Date('2025-06-18'), sendType: 'Redpoint', rating: 5, noteText: 'One of the best 8c routes in the world.', routeType: 'Sport', attemptCount: 15, isProject: false },
  { recordName: 'mock-17', route: 'Era Vella', climbingArea: 'Margalef', crag: 'Finestres', difficulty: '7c', date: new Date('2026-03-05'), sendType: 'Redpoint', rating: 4, noteText: 'Margalef conglomerate — so unique.', routeType: 'Sport', attemptCount: 3, isProject: false },
  { recordName: 'mock-18', route: 'Bain de Sang', climbingArea: 'Buoux', crag: 'Les Gours Noirs', difficulty: '7a', date: new Date('2026-01-25'), sendType: 'Redpoint', rating: 3, noteText: 'Classic Buoux endurance route.', routeType: 'Sport', attemptCount: 4, isProject: false },
  { recordName: 'mock-19', route: 'La Nuit des Temps', climbingArea: 'Orgon', crag: 'Falaise Sud', difficulty: '7b', date: new Date('2026-02-08'), sendType: 'Redpoint', rating: 4, noteText: 'Beautiful line on tufa pillars.', routeType: 'Sport', attemptCount: 6, isProject: false },
  { recordName: 'mock-20', route: 'Spit Boy', climbingArea: 'Magic Wood', crag: 'Hauptwand', difficulty: '7b', date: new Date('2025-08-20'), sendType: 'Flash', rating: 4, noteText: 'Slabby compression problem.', routeType: 'Boulder', attemptCount: 1, isProject: false },
  { recordName: 'mock-21', route: 'Super Crackinette', climbingArea: 'Saint-Léger', crag: 'Falaise Principale', difficulty: '8b+', date: new Date('2024-10-09'), sendType: 'Redpoint', rating: 5, noteText: 'World-class pocket sequence.', routeType: 'Sport', attemptCount: 20, isProject: false },
  { recordName: 'mock-22', route: 'Gecko Assis', climbingArea: 'Fontainebleau', crag: 'Cuvier Rempart', difficulty: '6b', date: new Date('2026-01-18'), sendType: 'On Sight', rating: 3, noteText: 'Good warm-up problem.', routeType: 'Boulder', attemptCount: 1, isProject: false },
];

const MOCK_SESSIONS = [
  { recordName: 'mock-ts-1',  id: 'ts-1',  date: new Date('2026-03-20'), type: 'Hangboard',    duration: 45,  intensity: 4, notes: 'Max hangs protocol, 20mm edge.' },
  { recordName: 'mock-ts-2',  id: 'ts-2',  date: new Date('2026-03-18'), type: 'Gym Session',  duration: 120, intensity: 3, notes: null },
  { recordName: 'mock-ts-3',  id: 'ts-3',  date: new Date('2026-03-15'), type: 'Campus Board', duration: 30,  intensity: 5, notes: 'Limit bouldering after. Felt strong.' },
  { recordName: 'mock-ts-4',  id: 'ts-4',  date: new Date('2026-03-10'), type: 'Hangboard',    duration: 45,  intensity: 3, notes: 'Repeaters, 7s on / 3s off.' },
  { recordName: 'mock-ts-5',  id: 'ts-5',  date: new Date('2026-03-05'), type: 'Yoga',         duration: 60,  intensity: 2, notes: 'Recovery day.' },
  { recordName: 'mock-ts-6',  id: 'ts-6',  date: new Date('2026-02-28'), type: 'Gym Session',  duration: 90,  intensity: 4, notes: null },
  { recordName: 'mock-ts-7',  id: 'ts-7',  date: new Date('2026-02-20'), type: 'Hangboard',    duration: 45,  intensity: 4, notes: 'Added pinches this week.' },
  { recordName: 'mock-ts-8',  id: 'ts-8',  date: new Date('2026-02-14'), type: 'Running',      duration: 40,  intensity: 3, notes: '6km easy pace.' },
  { recordName: 'mock-ts-9',  id: 'ts-9',  date: new Date('2026-02-08'), type: 'Gym Session',  duration: 100, intensity: 4, notes: 'Good power endurance circuit.' },
  { recordName: 'mock-ts-10', id: 'ts-10', date: new Date('2026-01-30'), type: 'Campus Board', duration: 35,  intensity: 5, notes: 'Moving on rungs 1-4-7.' },
  { recordName: 'mock-ts-11', id: 'ts-11', date: new Date('2026-01-22'), type: 'Yoga',         duration: 55,  intensity: 2, notes: 'Hip opening focus.' },
  { recordName: 'mock-ts-12', id: 'ts-12', date: new Date('2026-01-15'), type: 'Hangboard',    duration: 45,  intensity: 3, notes: 'Volume day, high reps.' },
  { recordName: 'mock-ts-13', id: 'ts-13', date: new Date('2026-01-08'), type: 'Gym Session',  duration: 110, intensity: 3, notes: null },
  { recordName: 'mock-ts-14', id: 'ts-14', date: new Date('2025-12-20'), type: 'Running',      duration: 50,  intensity: 3, notes: '8km base building.' },
];

const MOCK_API_KEYS = [
  { id: 'mock-key-001', label: 'Home Dashboard',          scopes: ['climbs:read', 'training:read'], createdAt: '2026-03-15T10:30:00.000Z', lastUsedAt: '2026-04-28T08:12:00.000Z' },
  { id: 'mock-key-002', label: 'Training Tracker Script', scopes: ['training:read'],                createdAt: '2026-04-01T14:00:00.000Z', lastUsedAt: null },
];

// Sample central route database — covers variety of crags, areas, grades and route types.
// Designed so partial-crag search is testable, e.g.:
//   "bio"  → Biographie           crag "La Fa"  → La Face routes
//   "bat"  → Bat Route            crag "Gours"  → Les Gours Noirs routes
//   "action" → Action Directe     crag "wald"   → Waldkopf
//   "papi"  → Papichulo           crag "pal"    → Sector Pal
//   "dream" → Dreamtime, Dream    crag "cre"    → Cresciano
//   "la"    → La Dura Dura, etc.
let MOCK_ROUTES = [
  { id: 'r-01', name: 'Biographie',          climbingArea: 'Ceüse',         crag: 'La Face',              grade: '9a',  routeType: 'Sport',   sendCount: 42,  projectCount: 18, attemptCount: 380, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-02', name: 'Nouveau Monde',        climbingArea: 'Ceüse',         crag: 'La Face',              grade: '8c+', routeType: 'Sport',   sendCount: 28,  projectCount: 11, attemptCount: 210, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-03', name: 'Bronx',               climbingArea: 'Ceüse',         crag: 'La Face',              grade: '8a',  routeType: 'Sport',   sendCount: 87,  projectCount: 5,  attemptCount: 430, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-04', name: 'Bat Route',           climbingArea: 'Buoux',         crag: 'Les Gours Noirs',      grade: '8c',  routeType: 'Sport',   sendCount: 19,  projectCount: 9,  attemptCount: 175, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-05', name: 'Bain de Sang',        climbingArea: 'Buoux',         crag: 'Les Gours Noirs',      grade: '7a',  routeType: 'Sport',   sendCount: 156, projectCount: 3,  attemptCount: 520, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-06', name: 'La Dura Dura',        climbingArea: 'Oliana',        crag: 'Sector Pal',           grade: '9a+', routeType: 'Sport',   sendCount: 6,   projectCount: 22, attemptCount: 290, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-07', name: 'Papichulo',           climbingArea: 'Oliana',        crag: 'Sector Pal',           grade: '8c',  routeType: 'Sport',   sendCount: 55,  projectCount: 14, attemptCount: 340, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-08', name: 'Action Directe',      climbingArea: 'Frankenjura',   crag: 'Waldkopf',             grade: '9a',  routeType: 'Sport',   sendCount: 33,  projectCount: 27, attemptCount: 500, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-09', name: 'Rotpunkt Classic',    climbingArea: 'Frankenjura',   crag: 'Bärenschlucht',        grade: '7c',  routeType: 'Sport',   sendCount: 74,  projectCount: 2,  attemptCount: 210, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-10', name: 'Dreamtime',           climbingArea: 'Cresciano',     crag: 'Dreamtime Block',      grade: '8b',  routeType: 'Boulder', sendCount: 48,  projectCount: 20, attemptCount: 600, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-11', name: 'Dream Catcher',       climbingArea: 'Magic Wood',    crag: 'Hauptwand',            grade: '7c',  routeType: 'Boulder', sendCount: 61,  projectCount: 7,  attemptCount: 280, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-12', name: 'Hubble',              climbingArea: 'Raven Tor',     crag: 'Main Wall',            grade: '8b+', routeType: 'Sport',   sendCount: 24,  projectCount: 10, attemptCount: 190, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-13', name: 'Planta de Shiva',     climbingArea: 'Siurana',       crag: 'El Pati',              grade: '7b+', routeType: 'Sport',   sendCount: 110, projectCount: 4,  attemptCount: 350, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-14', name: 'Golpe de Estado',     climbingArea: 'Siurana',       crag: 'El Pati',              grade: '8a',  routeType: 'Sport',   sendCount: 82,  projectCount: 6,  attemptCount: 300, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-15', name: 'Era Vella',           climbingArea: 'Margalef',      crag: 'Finestres',            grade: '7c',  routeType: 'Sport',   sendCount: 93,  projectCount: 3,  attemptCount: 270, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-16', name: 'Super Crackinette',   climbingArea: 'Saint-Léger',   crag: 'Falaise Principale',   grade: '8b+', routeType: 'Sport',   sendCount: 37,  projectCount: 12, attemptCount: 220, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-17', name: 'Le Bombé',            climbingArea: 'Fontainebleau', crag: 'Cuvier Rempart',       grade: '7a',  routeType: 'Sport',   sendCount: 205, projectCount: 1,  attemptCount: 800, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-18', name: 'La Nuit des Temps',   climbingArea: 'Orgon',         crag: 'Falaise Sud',          grade: '7b',  routeType: 'Sport',   sendCount: 68,  projectCount: 5,  attemptCount: 240, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-19', name: 'Move',               climbingArea: 'Magic Wood',    crag: 'Hauptwand',            grade: '7c+', routeType: 'Boulder', sendCount: 44,  projectCount: 8,  attemptCount: 310, isOrphaned: false, createdBy: 'user-other' },
  { id: 'r-20', name: 'La Rose et le Vampire', climbingArea: 'Buoux',       crag: 'La Dalle aux Plaques', grade: '7c',  routeType: 'Sport',   sendCount: 58,  projectCount: 4,  attemptCount: 195, isOrphaned: false, createdBy: 'user-other' },
  // Route owned by the mock user — shows 👤 indicator
  { id: 'r-21', name: 'Biographie Direct',   climbingArea: 'Ceüse',         crag: 'La Face',              grade: '9b',  routeType: 'Sport',   sendCount: 2,   projectCount: 5,  attemptCount: 40,  isOrphaned: false, createdBy: 'mock-user-001' },
];
