/** Базовый URL vitals API (без завершающего /). */
export const VITALS_API_BASE = location.origin; // local mirror: static snapshot in /api/vitals/

/** @typedef {'monospace' | 'graphik'} VitalsTextStyle */

/**
 * Стиль текста vitals:
 * - 'monospace' — моноширинный шрифт, рамка, выравнивание по левому краю
 * - 'graphik' — Graphik, простые строки, центральная выключка
 * @type {VitalsTextStyle}
 */
export const VITALS_TEXT_STYLE =  'graphik';
// export const VITALS_TEXT_STYLE =  'monospace';

/** @typedef {'plane' | 'cylinder'} VitalsLayout */

/**
 * Размещение vitals в сцене:
 * - 'plane' — плоская панель у модели (локальные координаты)
 * - 'cylinder' — цилиндр вокруг камеры (мировые координаты)
 * @type {VitalsLayout}
 */
export const VITALS_LAYOUT = 'cylinder';//'cylinder'; // 'plane'
