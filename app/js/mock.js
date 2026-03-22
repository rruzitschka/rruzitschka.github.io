// =============================================================================
// Section 1 — CloudKit globals stub
// Shadow CloudKit globals — prevents errors if auth.js/climbs.js reference them
// =============================================================================
const container = { signOut: () => Promise.resolve(), userRecordName: 'mock-user-001' };
const database  = {};

// =============================================================================
// Section 2 — initAuth() override
// Returns fake user, no redirect
// =============================================================================
async function initAuth() {
  return {
    nameComponents: { givenName: 'Alex', familyName: 'Climber' },
    lookupInfo: { emailAddress: 'alex@example.com' }
  };
}

// =============================================================================
// Section 3 — fetchClimbs() override
// Returns mock data or empty array
// =============================================================================
async function fetchClimbs() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('empty') === '1') return [];
  return MOCK_CLIMBS;
}

// =============================================================================
// Section 4 — MOCK_CLIMBS dataset
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
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
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
    isProject: false,
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
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
    projectStatus: 'In Progress',
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
    projectStatus: 'In Progress',
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
    projectStatus: 'In Progress',
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
    isProject: false,
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
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
    isProject: false,
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
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
    isProject: false,
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
  },
  {
    recordName: 'mock-9',
    route: 'Le Bombé',
    climbingArea: 'Fontainebleau',
    crag: 'Cuvier Rempart',
    difficulty: '7a',
    date: new Date('2024-03-18'),
    sendType: 'Pinkpoint',
    rating: 3,
    noteText: 'Pre-placed gear at the crux.',
    routeType: 'Sport',
    attemptCount: 2,
    isProject: false,
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
  },
  {
    recordName: 'mock-10',
    route: 'Morning Glory Wall Direct South Face Extended Start',
    climbingArea: 'Smith Rock',
    crag: 'Monument Area Lower Tier',
    difficulty: '5.11a',
    date: new Date('2024-06-22'),
    sendType: 'Redpoint',
    rating: 4,
    noteText: 'Long approach but worth it.',
    routeType: 'Multi-Pitch',
    attemptCount: 3,
    isProject: false,
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
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
    isProject: false,
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
  },
  {
    recordName: 'mock-12',
    route: 'The Salathe Wall',
    climbingArea: 'Yosemite',
    crag: 'El Capitan',
    difficulty: '5.13b',
    date: new Date('2024-09-30'),
    sendType: 'Redpoint',
    rating: 5,
    noteText: 'Four days on the wall. Free climbing El Cap — bucket list done.',
    routeType: 'Multi-Pitch',
    attemptCount: 6,
    isProject: false,
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
  },
  {
    recordName: 'mock-13',
    route: 'Shadowboxing',
    climbingArea: 'Rifle',
    crag: 'Bauhaus',
    difficulty: '5.14a',
    date: new Date('2025-07-08'),
    sendType: 'Redpoint',
    rating: 4,
    noteText: 'Rifle limestone is brutally sustained.',
    routeType: 'Sport',
    attemptCount: 18,
    isProject: false,
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
  },
  {
    recordName: 'mock-14',
    route: 'Dreamtime',
    climbingArea: 'Cresciano',
    crag: 'Dreamtime Block',
    difficulty: '8b',
    date: new Date('2025-03-25'),
    sendType: 'On Sight',
    rating: 0,
    noteText: null,
    routeType: 'Boulder',
    attemptCount: 1,
    isProject: false,
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
  },
  {
    recordName: 'mock-15',
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
    isProject: false,
    projectStatus: null,
    highPoint: null,
    lastAttemptDate: null,
    projectNotes: null
  }
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
