// training.js — Fetch + write TrainingSessions; compute training stats

const TRAINING_TYPES = [
  'Hangboard', 'Campus Board', 'System Wall',
  'Gym Session', 'Yoga', 'Running', 'Strength'
];

const TYPE_EMOJI = {
  'Hangboard':    '🏋️',
  'Campus Board': '🪜',
  'System Wall':  '🧩',
  'Gym Session':  '🧗',
  'Yoga':         '🧘',
  'Running':      '🏃',
  'Strength':     '💪',
};

async function fetchTrainingSessions() {
  const response = await database.performQuery({
    recordType: 'CD_TrainingSession',
    sortBy: [{ fieldName: 'CD_date', ascending: false }]
  });
  return response.records.map(r => ({
    recordName: r.recordName,
    id:         r.fields.CD_id?.value ?? r.recordName,
    date:       r.fields.CD_date?.value ? new Date(r.fields.CD_date.value) : null,
    type:       r.fields.CD_type?.value ?? 'Gym Session',
    duration:   r.fields.CD_duration?.value ?? 60,
    intensity:  r.fields.CD_intensity?.value ?? 3,
    notes:      r.fields.CD_notes?.value ?? null,
  }));
}

async function saveTrainingSession(session) {
  const record = {
    recordType: 'CD_TrainingSession',
    fields: {
      CD_id:        { value: session.id ?? crypto.randomUUID() },
      CD_date:      { value: session.date ? session.date.getTime() : Date.now() },
      CD_type:      { value: session.type },
      CD_duration:  { value: Number(session.duration) },
      CD_intensity: { value: Number(session.intensity) },
      CD_notes:     { value: session.notes || null },
    }
  };
  if (session.recordName) record.recordName = session.recordName;
  const response = await database.saveRecords([record]);
  return response.records[0];
}

async function deleteTrainingSession(recordName) {
  await database.deleteRecords([{ recordName, recordType: 'CD_TrainingSession' }]);
}

function computeTrainingStats(sessions, period) {
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

  const sessionsByType = {};
  for (const s of filtered) {
    sessionsByType[s.type] = (sessionsByType[s.type] ?? 0) + 1;
  }

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

  return { totalSessions, totalMinutes, trainingDays, sessionsByType, avgPerWeek, formattedTotalTime };
}
