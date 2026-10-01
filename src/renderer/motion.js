export const MOTION_STORAGE_KEY = 'kadal_motion';

export function readMotion() {
  try { return localStorage.getItem(MOTION_STORAGE_KEY) !== 'paused'; }
  catch { return true; }
}

export function applyMotion(enabled, persist = true) {
  document.documentElement.dataset.motion = enabled ? 'playful' : 'paused';
  if (persist) {
    try { localStorage.setItem(MOTION_STORAGE_KEY, enabled ? 'playful' : 'paused'); }
    catch { /* The preference still works when storage is unavailable. */ }
  }
  return enabled;
}
