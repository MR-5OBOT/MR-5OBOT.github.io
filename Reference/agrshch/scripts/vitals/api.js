/**
 * Ответ `GET /api/vitals/latest` (camelCase, только перечисленные поля).
 * @typedef {{
 *   heartRate: number | null,
 *   stepsToday: number | null,
 *   stepsAverage30days: number | null,
 *   sleepToday: number | null,
 *   lastWorkout: string | null,
 *   activeCaloriesToday: number | null,
 *   updatedAt: string,
 * }} LatestResponse
 */

function normalizeBase(apiBase) {
  return String(apiBase).replace(/\/$/, '');
}

/**
 * @param {string} apiBase Базовый URL без завершающего `/`
 * @param {string | undefined} [deviceId]
 * @returns {Promise<LatestResponse>}
 */
export async function fetchLatest(apiBase, deviceId) {
  const base = normalizeBase(apiBase);
  const url = new URL('/api/vitals/latest', `${base}/`);
  if (deviceId) url.searchParams.set('device_id', deviceId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET /latest → ${res.status}`);
  return res.json();
}

/**
 * SSE после каждого успешного ingest; по событию `snapshot` перезапрашивайте `/latest`.
 * @param {string} apiBase
 * @param {(msg: { type?: string; device_id?: string; captured_at?: string }) => void} onSnapshot
 * @returns {EventSource}
 */
export function openVitalsEventSource(apiBase, onSnapshot) {
  const base = normalizeBase(apiBase);
  const url = `${base}/api/vitals/events`;
  const es = new EventSource(url);
  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'snapshot') onSnapshot(msg);
    } catch {
      // пинги / не-JSON игнорируем
    }
  };
  return es;
}

/** Для подключения без сборщика: после импорта можно повесить на `window.VitalsApi`. */
export const VitalsApi = {
  fetchLatest,
  openEventSource: openVitalsEventSource,
};
