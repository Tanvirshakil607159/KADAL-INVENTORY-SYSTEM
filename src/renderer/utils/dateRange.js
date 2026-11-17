// Date filters are local calendar days ("YYYY-MM-DD", Bangladesh time); stored timestamps are UTC.
// Convert a local day into UTC ISO bounds for Supabase queries.
const toDate = (day, endOfDay) => {
  if (!day) return null;
  const s = String(day).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
export const dayStartIso = (day) => toDate(day, false)?.toISOString() ?? null;
export const dayEndIso = (day) => toDate(day, true)?.toISOString() ?? null;
