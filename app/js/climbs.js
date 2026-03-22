// climbs.js — Fetch and filter CD_ClimbNote records from CloudKit

const PAGE_SIZE = 50;

// Fetch all climbs, sorted by date descending
async function fetchClimbs({ area = null, year = null, sendType = null, search = null } = {}) {
  const query = {
    recordType: 'CD_ClimbNote',
    sortBy: [{ fieldName: 'CD_date', ascending: false }]
  };

  // CloudKit JS supports only one filterBy clause per query with apiTokenAuth
  // Client-side filtering is applied after fetch for compound filters
  const response = await database.performQuery(query, { resultsLimit: 200 });
  if (response.hasErrors) throw new Error(response.errors[0].serverErrorCode);

  let records = response.records.map(mapRecord);

  // Client-side filters
  if (area)     records = records.filter(r => r.climbingArea === area);
  if (year)     records = records.filter(r => r.date && r.date.getFullYear() === parseInt(year));
  if (sendType) records = records.filter(r => r.sendType === sendType);
  if (search) {
    const q = search.toLowerCase();
    records = records.filter(r =>
      r.route?.toLowerCase().includes(q) ||
      r.climbingArea?.toLowerCase().includes(q) ||
      r.crag?.toLowerCase().includes(q)
    );
  }

  return records;
}

// Map a raw CloudKit record to a plain JS object
function mapRecord(ckRecord) {
  const f = ckRecord.fields;
  return {
    recordName:      ckRecord.recordName,
    route:           f.CD_route?.value ?? '',
    climbingArea:    f.CD_climbingArea?.value ?? '',
    crag:            f.CD_crag?.value ?? '',
    difficulty:      f.CD_difficulty?.value ?? '',
    date:            f.CD_date?.value ? new Date(f.CD_date.value) : null,
    sendType:        f.CD_sendType?.value ?? '',
    rating:          f.CD_rating?.value ?? 0,
    noteText:        f.CD_noteText?.value ?? '',
    routeType:       f.CD_routeType?.value ?? 'Sport',
    attemptCount:    f.CD_attemptCount?.value ?? 0,
    projectStatus:   f.CD_projectStatus?.value ?? null,
    highPoint:       f.CD_highPoint?.value ?? null,
    lastAttemptDate: f.CD_lastAttemptDate?.value ? new Date(f.CD_lastAttemptDate.value) : null,
    projectNotes:    f.CD_projectNotes?.value ?? null,
    isProject:       (f.CD_sendType?.value === 'Project')
  };
}

// Compute quick stats from a list of climbs
function computeStats(climbs) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisYearClimbs = climbs.filter(c => c.date?.getFullYear() === thisYear);

  // Streak: consecutive calendar days with at least one climb (counting today/yesterday)
  const sortedDates = [...new Set(
    climbs.filter(c => c.date).map(c => c.date.toDateString())
  )].sort().reverse();
  let streak = 0;
  let checkDate = new Date();
  for (const dateStr of sortedDates) {
    const d = new Date(dateStr);
    const diff = Math.round((checkDate - d) / 86400000);
    if (diff <= 1) { streak++; checkDate = d; }
    else break;
  }

  return {
    total: climbs.length,
    thisYear: thisYearClimbs.length,
    streak,
    hardestThisYear: thisYearClimbs
      .map(c => c.difficulty)
      .filter(Boolean)
      .sort()
      .at(-1) ?? '—'
  };
}

// Filter climbs in-memory (used by UI filter handlers)
function filterClimbs(climbs, { area, year, sendType, routeType, search, sort } = {}) {
  let result = [...climbs];
  if (area)      result = result.filter(r => r.climbingArea === area);
  if (year)      result = result.filter(r => r.date?.getFullYear() === parseInt(year));
  if (sendType)  result = result.filter(r => r.sendType === sendType);
  if (routeType) result = result.filter(r => r.routeType === routeType);
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(r =>
      r.route?.toLowerCase().includes(q) ||
      r.climbingArea?.toLowerCase().includes(q) ||
      r.crag?.toLowerCase().includes(q)
    );
  }
  if (sort === 'grade-asc')  result.sort((a, b) => (a.difficulty ?? '').localeCompare(b.difficulty ?? ''));
  if (sort === 'grade-desc') result.sort((a, b) => (b.difficulty ?? '').localeCompare(a.difficulty ?? ''));
  if (sort === 'date-asc')   result.sort((a, b) => (a.date ?? 0) - (b.date ?? 0));
  // default: date-desc (already sorted from fetch)
  return result;
}

// ---- Write Operations ----

async function saveClimbNote(climbData) {
  const record = {
    recordType: 'CD_ClimbNote',
    fields: {
      CD_id:            { value: climbData.id ?? crypto.randomUUID() },
      CD_route:         { value: climbData.route },
      CD_climbingArea:  { value: climbData.climbingArea || null },
      CD_crag:          { value: climbData.crag || null },
      CD_difficulty:    { value: climbData.difficulty || null },
      CD_date:          { value: climbData.date ? climbData.date.getTime() : null },
      CD_sendType:      { value: climbData.sendType ?? 'Redpoint' },
      CD_routeType:     { value: climbData.routeType ?? 'Sport' },
      CD_rating:        { value: Number(climbData.rating ?? 0) },
      CD_noteText:      { value: climbData.noteText || null },
      CD_attemptCount:  { value: Number(climbData.attemptCount ?? 0) },
      CD_highPoint:     { value: climbData.highPoint || null },
      CD_projectStatus: { value: climbData.projectStatus || null },
      CD_projectNotes:  { value: climbData.projectNotes || null },
    }
  };
  if (climbData.recordName) record.recordName = climbData.recordName;
  const response = await database.saveRecords([record]);
  return response.records[0];
}

async function deleteClimbNote(recordName) {
  // CloudKit does not cascade deletes — delete child Ascent records first
  const ascentResponse = await database.performQuery({
    recordType: 'CD_Ascent',
    filterBy: [{
      fieldName: 'CD_climbNote',
      comparator: 'EQUALS',
      fieldValue: { value: { recordName } }
    }]
  });
  const ascentIDs = (ascentResponse.records ?? []).map(r => ({
    recordName: r.recordName, recordType: 'CD_Ascent'
  }));
  if (ascentIDs.length) await database.deleteRecords(ascentIDs);
  await database.deleteRecords([{ recordName, recordType: 'CD_ClimbNote' }]);
}

async function saveAscent(ascentData) {
  const record = {
    recordType: 'CD_Ascent',
    fields: {
      CD_id:       { value: ascentData.id ?? crypto.randomUUID() },
      CD_date:     { value: ascentData.date ? ascentData.date.getTime() : Date.now() },
      CD_sendType: { value: ascentData.sendType ?? 'Redpoint' },
      CD_notes:    { value: ascentData.notes || null },
      CD_climbNote: { value: { recordName: ascentData.climbNoteRecordName } },
    }
  };
  if (ascentData.recordName) record.recordName = ascentData.recordName;
  const response = await database.saveRecords([record]);
  return response.records[0];
}

async function deleteAscent(recordName) {
  await database.deleteRecords([{ recordName, recordType: 'CD_Ascent' }]);
}
