// =============================================================================
// Section 1 — CloudKit globals stub
// Shadow CloudKit globals — prevents errors if auth.js/climbs.js reference them
// =============================================================================
const container = { signOut: () => Promise.resolve(), userRecordName: 'mock-user-001' };
const database  = {};

// =============================================================================
// Section 2 — initAuth() override with all window.* overrides
// Returns fake user and overrides all CloudKit functions
// =============================================================================
window.initAuth = function(callback) {
  const user = {
    nameComponents: { givenName: 'Alex', familyName: 'Climber' },
    lookupInfo: { emailAddress: 'alex@example.com' }
  };
  
  // Override fetchClimbs
  window.fetchClimbs = async function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('empty') === '1') return [];
    return [...MOCK_CLIMBS];
  };

  // Override fetchTrainingSessions
  window.fetchTrainingSessions = async function() {
    return [...MOCK_SESSIONS];
  };

  // Override saveTrainingSession
  window.saveTrainingSession = async function(session) {
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
    return saved;
  };

  // Override deleteTrainingSession
  window.deleteTrainingSession = async function(recordName) {
    const idx = MOCK_SESSIONS.findIndex(s => s.recordName === recordName);
    if (idx !== -1) MOCK_SESSIONS.splice(idx, 1);
    console.log('[Mock] deleted TrainingSession', recordName);
  };

  // Override saveClimbNote
  window.saveClimbNote = async function(climbData) {
    const isNew = !climbData.recordName;
    const rn = climbData.recordName ?? ('mock-cn-new-' + Date.now());
    const saved = { ...climbData, recordName: rn, id: climbData.id ?? crypto.randomUUID(), isProject: climbData.sendType === 'Project' };
    if (isNew) {
      MOCK_CLIMBS.unshift(saved);
    } else {
      const idx = MOCK_CLIMBS.findIndex(c => c.recordName === rn);
      if (idx !== -1) MOCK_CLIMBS[idx] = saved;
    }
    console.log('[Mock] saved ClimbNote', rn);
    return saved;
  };

  // Override deleteClimbNote
  window.deleteClimbNote = async function(recordName) {
    const idx = MOCK_CLIMBS.findIndex(c => c.recordName === recordName);
    if (idx !== -1) MOCK_CLIMBS.splice(idx, 1);
    console.log('[Mock] deleted ClimbNote', recordName);
  };

  // Override fetchPhotos
  window.fetchPhotos = async function(noteId) {
    if (noteId === 'mock-1') {
      return [
        { id: 'mock-photo-1', storageURL: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600&q=80', fileName: 'biographie.jpg', createdAt: new Date('2026-08-15') }
      ];
    }
    return [];
  };

  // Override saveAscent
  window.saveAscent = async function(ascentData) {
    const rn = ascentData.recordName ?? ('mock-asc-' + Date.now());
    console.log('[Mock] saved Ascent', rn);
    return { ...ascentData, recordName: rn };
  };

  // Override deleteAscent
  window.deleteAscent = async function(recordName) {
    console.log('[Mock] deleted Ascent', recordName);
  };

  if (callback) callback(user);
  return Promise.resolve(user);
};

// =============================================================================
// Section 3 — MOCK_CLIMBS dataset
// =============================================================================
const MOCK_CLIMBS = [
  {
    recordName: 'mock-1',
    route: 'Biographie',
    climbingArea: 'Ceüse',
    crag: 'La Face',
    difficulty: '9a',
    date: new Date('2026-08-15'),
    sendType: 'Redpoint',
    rating: 5,
    noteText: 'Dream route, finally!',
    routeType: 'Sport',
    attemptCount: 47,
    isProject: false,
    ascents: [
      { recordName: 'mock-1/asc-1', id: 'asc-1', date: new Date('2026-09-10'), sendType: 'Redpoint', notes: 'Even better second time' },
      { recordName: 'mock-1/asc-2', id: 'asc-2', date: new Date('2026-10-03'), sendType: 'Redpoint', notes: null },
    ]
  },
  {
    recordName: 'mock-2',
    route: 'Bat Route',
    climbingArea: 'Buoux',
    crag: 'Les Gours Noirs',
    difficulty: '8c',
    date: new Date('2026-05-20'),
    sendType: 'Redpoint',
    rating: 4,
    noteText: 'Powerful crimping sequence in the middle crux.',
    routeType: 'Sport',
    attemptCount: 12,
    isProject: false
  },
  {
    recordName: 'mock-3',
    route: 'La Dura Dura',
    climbingArea: 'Oliana',
    crag: 'Sector Pal',
    difficulty: '9a+',
    date: null,
    sendType: 'Project',
    rating: 0,
    noteText: null,
    routeType: 'Sport',
    attemptCount: 23,
    isProject: true,
    projectStatus: 'Close',
    highPoint: 'Third bolt clip',
    lastAttemptDate: new Date('2026-03-01'),
    projectNotes: 'Need to work the lower crux more. The move off the sidepull is the key.'
  },
  {
    recordName: 'mock-4',
    route: 'Action Directe',
    climbingArea: 'Frankenjura',
    crag: 'Waldkopf',
    difficulty: '9a',
    date: null,
    sendType: 'Project',
    rating: 0,
    noteText: null,
    routeType: 'Sport',
    attemptCount: 8,
    isProject: true,
    projectStatus: 'Working',
    highPoint: 'Move 4 of 7',
    lastAttemptDate: new Date('2025-11-10'),
    projectNotes: null
  },
  {
    recordName: 'mock-5',
    route: 'Hubble',
    climbingArea: 'Raven Tor',
    crag: null,
    difficulty: '8b+',
    date: null,
    sendType: 'Project',
    rating: 0,
    noteText: null,
    routeType: 'Sport',
    attemptCount: 3,
    isProject: true,
    projectStatus: 'Working',
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
  },
  {
    recordName: 'mock-6',
    route: 'Rotpunkt Classic',
    climbingArea: 'Frankenjura',
    crag: 'Bärenschlucht',
    difficulty: '7c',
    date: new Date('2024-07-04'),
    sendType: 'Redpoint',
    rating: 3,
    noteText: 'Old school Frankenjura climbing — so good.',
    routeType: 'Sport',
    attemptCount: 4,
    isProject: false
  },
  {
    recordName: 'mock-7',
    route: 'Planta de Shiva',
    climbingArea: 'Siurana',
    crag: 'El Pati',
    difficulty: '7b+',
    date: new Date('2025-04-12'),
    sendType: 'On Sight',
    rating: 5,
    noteText: 'Perfect onsight conditions, cool morning.',
    routeType: 'Sport',
    attemptCount: 1,
    isProject: false
  },
  {
    recordName: 'mock-8',
    route: 'Move',
    climbingArea: 'Magic Wood',
    crag: 'Hauptwand',
    difficulty: '7c+',
    date: new Date('2025-09-03'),
    sendType: 'Flash',
    rating: 4,
    noteText: 'Got the beta from a friend the day before — counts as flash!',
    routeType: 'Boulder',
    attemptCount: 1,
    isProject: false
  },
  {
    recordName: 'mock-9',
    route: 'Le Bombé',
    climbingArea: 'Fontainebleau',
    crag: 'Cuvier Rempart',
    difficulty: '7a',
    date: new Date('2024-03-18'),
    sendType: 'Redpoint',
    rating: 3,
    noteText: 'Pre-placed gear at the crux.',
    routeType: 'Sport',
    attemptCount: 2,
    isProject: false
  },
  {
    recordName: 'mock-10',
    route: 'La Rose et le Vampire',
    climbingArea: 'Buoux',
    crag: 'La Dalle aux Plaques',
    difficulty: '7c',
    date: new Date('2024-06-22'),
    sendType: 'Redpoint',
    rating: 4,
    noteText: 'Technical face climbing on small crimps.',
    routeType: 'Sport',
    attemptCount: 5,
    isProject: false
  },
  {
    recordName: 'mock-11',
    route: 'Easy Does It',
    climbingArea: 'Local Gym',
    crag: null,
    difficulty: '6b',
    date: new Date('2026-01-10'),
    sendType: 'Flash',
    rating: 0,
    noteText: null,
    routeType: 'Boulder',
    attemptCount: 1,
    isProject: false
  },
  {
    recordName: 'mock-12',
    route: 'Dreamtime',
    climbingArea: 'Cresciano',
    crag: 'Dreamtime Block',
    difficulty: '8b',
    date: new Date('2025-03-25'),
    sendType: 'Redpoint',
    rating: 5,
    noteText: 'Took 30 attempts. Worth every one.',
    routeType: 'Boulder',
    attemptCount: 30,
    isProject: false
  },
  {
    recordName: 'mock-13',
    route: 'Nouveau Monde',
    climbingArea: 'Ceüse',
    crag: 'La Face',
    difficulty: '8c+',
    date: new Date('2026-02-14'),
    sendType: 'Redpoint',
    rating: 4,
    noteText: "Valentine's Day send. Best gift ever.",
    routeType: 'Sport',
    attemptCount: 31,
    isProject: false
  },
  {
    recordName: 'mock-14',
    route: 'Bronx',
    climbingArea: 'Céüse',
    crag: 'La Face',
    difficulty: '8a',
    date: new Date('2025-11-02'),
    sendType: 'Redpoint',
    rating: 4,
    noteText: 'Great warm-up for the harder routes here.',
    routeType: 'Sport',
    attemptCount: 7,
    isProject: false
  },
  {
    recordName: 'mock-15',
    route: 'Golpe de Estado',
    climbingArea: 'Siurana',
    crag: 'El Pati',
    difficulty: '8a',
    date: new Date('2025-10-15'),
    sendType: 'On Sight',
    rating: 5,
    noteText: 'Incredible onsight! Aggressive compression style.',
    routeType: 'Sport',
    attemptCount: 1,
    isProject: false
  },
  {
    recordName: 'mock-16',
    route: 'Papichulo',
    climbingArea: 'Oliana',
    crag: 'Sector Pal',
    difficulty: '8c',
    date: new Date('2025-06-18'),
    sendType: 'Redpoint',
    rating: 5,
    noteText: 'One of the best 8c routes in the world.',
    routeType: 'Sport',
    attemptCount: 15,
    isProject: false
  },
  {
    recordName: 'mock-17',
    route: 'Era Vella',
    climbingArea: 'Margalef',
    crag: 'Finestres',
    difficulty: '7c',
    date: new Date('2026-03-05'),
    sendType: 'Redpoint',
    rating: 4,
    noteText: 'Margalef conglomerate — so unique.',
    routeType: 'Sport',
    attemptCount: 3,
    isProject: false
  },
  {
    recordName: 'mock-18',
    route: 'Bain de Sang',
    climbingArea: 'Buoux',
    crag: 'Les Gours Noirs',
    difficulty: '7a',
    date: new Date('2026-01-25'),
    sendType: 'Redpoint',
    rating: 3,
    noteText: 'Classic Buoux endurance route.',
    routeType: 'Sport',
    attemptCount: 4,
    isProject: false
  },
  {
    recordName: 'mock-19',
    route: 'La Nuit des Temps',
    climbingArea: 'Orgon',
    crag: 'Falaise Sud',
    difficulty: '7b',
    date: new Date('2026-02-08'),
    sendType: 'Redpoint',
    rating: 4,
    noteText: 'Beautiful line on tufa pillars.',
    routeType: 'Sport',
    attemptCount: 6,
    isProject: false
  },
  {
    recordName: 'mock-20',
    route: 'Spit Boy',
    climbingArea: 'Magic Wood',
    crag: 'Hauptwand',
    difficulty: '7b',
    date: new Date('2025-08-20'),
    sendType: 'Flash',
    rating: 4,
    noteText: 'Slabby compression problem. Fun beta.',
    routeType: 'Boulder',
    attemptCount: 1,
    isProject: false
  },
  {
    recordName: 'mock-21',
    route: 'Super Crackinette',
    climbingArea: 'Saint-Léger',
    crag: 'Falaise Principale',
    difficulty: '8b+',
    date: new Date('2024-10-09'),
    sendType: 'Redpoint',
    rating: 5,
    noteText: 'The crux sequence on pockets is world-class.',
    routeType: 'Sport',
    attemptCount: 20,
    isProject: false
  },
  {
    recordName: 'mock-22',
    route: 'Gecko Assis',
    climbingArea: 'Fontainebleau',
    crag: 'Cuvier Rempart',
    difficulty: '6b',
    date: new Date('2026-01-18'),
    sendType: 'On Sight',
    rating: 3,
    noteText: 'Good warm-up problem in the forest.',
    routeType: 'Boulder',
    attemptCount: 1,
    isProject: false
  },
];

// =============================================================================
// Section 4b — MOCK_SESSIONS dataset
// =============================================================================
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

// =============================================================================
// Section 5 — Mock banner
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const banner = document.createElement('div');
  banner.textContent = '🧪 Mock Mode — test data only';
  banner.style.cssText = 'background:#f97316;color:white;text-align:center;padding:6px;font-weight:600;font-size:0.85rem;position:relative;z-index:9999;';
  document.body.prepend(banner);
});

// =============================================================================
// Section 6 — Training/Goals nav placeholders
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-link').forEach(link => {
    const text = link.textContent.trim();
    if (text === 'Training' || text === 'Goals') {
      link.addEventListener('click', e => {
        e.preventDefault();
        showToast(`${text} — coming in Phase 3 🧗`, 'info');
      });
    }
  });
});
