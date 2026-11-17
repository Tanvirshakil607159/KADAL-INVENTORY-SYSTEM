// Date filters arrive as local calendar days ("YYYY-MM-DD", picked in Bangladesh time).
// Stored timestamps are UTC, so a local day runs from the previous day 18:00 UTC to 17:59:59 UTC.
// These helpers turn a local day into UTC bounds for Supabase (ISO) and SQLite (datetime()).

function toDate(day, endOfDay) {
  if (!day) return null;
  const s = String(day).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  const d = new Date(s); // already a full timestamp
  return isNaN(d.getTime()) ? null : d;
}

function dayStartIso(day) { const d = toDate(day, false); return d ? d.toISOString() : null; }
function dayEndIso(day) { const d = toDate(day, true); return d ? d.toISOString() : null; }

// SQLite: compare with datetime(column), which normalises "YYYY-MM-DD HH:MM:SS", ISO "...T...Z" and bare dates
function isoToSql(iso) { return iso ? iso.replace('T', ' ').slice(0, 19) : null; }
function dayStartSql(day) { return isoToSql(dayStartIso(day)); }
function dayEndSql(day) { return isoToSql(dayEndIso(day)); }

// In-memory filtering of rows that were fetched from Supabase
function inLocalRange(value, dateFrom, dateTo) {
  if (!value) return !dateFrom && !dateTo;
  const t = new Date(value).getTime();
  if (isNaN(t)) return false;
  if (dateFrom && t < new Date(dayStartIso(dateFrom)).getTime()) return false;
  if (dateTo && t > new Date(dayEndIso(dateTo)).getTime()) return false;
  return true;
}

// Last calendar day of a month, e.g. lastDayOfMonth(2026, 11) -> "2026-11-30"
function lastDayOfMonth(year, month) {
  const d = new Date(Number(year), Number(month), 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Local calendar date ("YYYY-MM-DD") of a UTC timestamp
function localDay(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayLocal() { return localDay(new Date()); }

module.exports = { dayStartIso, dayEndIso, dayStartSql, dayEndSql, inLocalRange, lastDayOfMonth, localDay, todayLocal };
