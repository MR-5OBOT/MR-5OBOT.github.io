import { VITALS_TEXT_STYLE } from './config.js';

function fmt(value) {
  return value == null ? 'n/a' : String(value);
}

function rounded(value) {
  if (value == null) return value;

  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : value;
}

function fmtHours(value, digits) {
  if (value == null) return 'n/a';

  const number = Number(value);
  const formatted = Number.isFinite(number)
    ? number.toFixed(digits)
    : String(value);
  return `${formatted} hrs`;
}

function vitalsRows(data) {
  return [
    ['Pulse:', fmt(data.heartRate)],
    ['Steps Today:', fmt(data.stepsToday)],
    ['Steps Average (30d):', fmt(data.stepsAverage30days)],
    ['Sleep Today:', fmtHours(data.sleepToday, 1)],
    ['Last Workout:', fmt(data.lastWorkout)],
    ['Active Calories:', fmt(rounded(data.activeCaloriesToday || 0))],
    ['Last Sync:', fmt(data.updatedAt)],
  ];
}

/** @param {import('./api.js').LatestResponse | Record<string, unknown>} data */
export function formatLatestLinesMonospace(data) {
  const rows = vitalsRows(data);

  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  const bodies = rows.map(
    ([label, value]) => `${label.padStart(labelWidth)} ${value}`,
  );
  const innerWidth = Math.max(...bodies.map((line) => line.length));
  const horizontal = '═'.repeat(innerWidth + 2);
  const top = `╔${horizontal}╗`;
  const bottom = `╚${horizontal}╝`;

  return [
    top,
    ...bodies.map((line) => `║ ${line.padEnd(innerWidth)} ║`),
    bottom,
  ];
}

/** @param {import('./api.js').LatestResponse | Record<string, unknown>} data */
export function formatLatestLinesGraphik(data) {
  return vitalsRows(data).map(([label, value]) => `${label} ${value}`);
}

/** @param {import('./api.js').LatestResponse | Record<string, unknown>} data */
export function formatLatestLines(data) {
  return VITALS_TEXT_STYLE === 'graphik'
    ? formatLatestLinesGraphik(data)
    : formatLatestLinesMonospace(data);
}
