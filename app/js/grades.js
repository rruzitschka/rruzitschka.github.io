// Grade system definitions — mirrored from GradeSystem.swift
// Order matches iOS app exactly (36 grades per system).

const GRADES = {
  French: [
    '3b', '3c', '4a', '4b', '4c', '5a', '5b', '5b+', '5c', '5c+',
    '6a', '6a+', '6b', '6b+', '6c', '6c+',
    '7a', '7a+', '7b', '7b+', '7c', '7c+',
    '8a', '8a+', '8b', '8b+', '8c', '8c+',
    '9a', '9a+', '9b', '9b+', '9c', '9c+',
    '10a', '10b'
  ],
  UIAA: [
    '3', '3+', '4-', '4', '4+', '5',
    '6-', '6-/6', '6', '6/6+',
    '6+', '7-', '7', '7+',
    '8-', '8', '8+',
    '9-', '9', '9+',
    '10-', '10', '10+',
    '11-', '11', '11+',
    '12-', '12', '12+',
    '13-', '13', '13+',
    '14-', '14', '14+', '15-'
  ],
  YDS: [
    '5.3', '5.4', '5.5', '5.6', '5.7', '5.8', '5.9', '5.9+',
    '5.10a', '5.10a+', '5.10b', '5.10c', '5.10d',
    '5.11a', '5.11b', '5.11c', '5.11d',
    '5.12a', '5.12b', '5.12c', '5.12d',
    '5.13a', '5.13b', '5.13c', '5.13d',
    '5.14a', '5.14b', '5.14c', '5.14d',
    '5.15a', '5.15b', '5.15c', '5.15d',
    '5.16a', '5.16b', '5.16c'
  ]
};

const GRADE_SYSTEM_KEY = 'sendlog_grade_system';

function getPreferredGradeSystem() {
  return localStorage.getItem(GRADE_SYSTEM_KEY) || 'French';
}

function setPreferredGradeSystem(system) {
  localStorage.setItem(GRADE_SYSTEM_KEY, system);
}

/** Detect which system a grade string belongs to. Returns 'French' as fallback. */
function detectGradeSystem(grade) {
  if (!grade) return getPreferredGradeSystem();
  for (const system of ['French', 'UIAA', 'YDS']) {
    if (GRADES[system].includes(grade)) return system;
  }
  return getPreferredGradeSystem();
}

/**
 * Populate a grade <select> element with options for the given system.
 * Optionally pre-select a value.
 */
function populateGradeSelect(selectEl, system, selectedValue) {
  selectEl.innerHTML = '<option value="">— select —</option>';
  for (const g of GRADES[system]) {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    if (g === selectedValue) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

/**
 * Populate a grade <select> using the user's preferred grade system.
 * Optionally pre-select an existing grade value (auto-detects its system).
 */
function initGradePicker(gradeSelectEl, initialGrade) {
  const system = initialGrade ? detectGradeSystem(initialGrade) : getPreferredGradeSystem();
  populateGradeSelect(gradeSelectEl, system, initialGrade);
}
