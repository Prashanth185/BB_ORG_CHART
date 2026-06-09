/** Node.js sqlite cannot bind `undefined` — use null for empty optional values. */
export function sqlValue(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string' && val.trim() === '') return null;
  return val;
}

export function sqlInt(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}
