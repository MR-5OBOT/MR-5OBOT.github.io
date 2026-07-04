import * as THREE from 'three';
import { fetchLatest, openVitalsEventSource } from './api.js';
import { VITALS_API_BASE, VITALS_LAYOUT, VITALS_TEXT_STYLE } from './config.js';
import { formatLatestLines as defaultFormatLatestLines } from './format.js';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
 || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);

const TEXT_STYLE_PRESETS = {
  monospace: {
    fontFamily: 'monospace',
    textAlign: 'left',
    fontLoadName: null,
  },
  graphik: {
    fontFamily: "'Graphik', sans-serif",
    textAlign: 'center',
    fontLoadName: 'Graphik',
  },
};

const textStyle = TEXT_STYLE_PRESETS[VITALS_TEXT_STYLE] ?? TEXT_STYLE_PRESETS.monospace;

const LAYOUT_PRESETS = {
  plane: {
    position: isMobile ? 
        { x: -0.3, y: 1.8, z: -0.5 } : 
        { x: -0.85, y: 1.4, z: -0.5 },
    lineHeight: 0.06,
    lineSpacing: 1.2,
    color: '#aa0000',
    fontSize: 180,
  },
  cylinder: {
    radius: 5.0,
    y: isMobile ? 2.2 : 1.7,
    lineHeight: isMobile ? 0.26 : 0.55,
    lineSpacing: 0.95,
    letterSpacing: isMobile ? '-5%' : '-6%',
    segments: 96,
    color: isMobile ? '#222222' : '#111111',
    opacity: 0.85,
    fontSize: 320,
  },
};

const layout = LAYOUT_PRESETS[VITALS_LAYOUT] ?? LAYOUT_PRESETS.cylinder;

const renderSettings = {
  ...layout,
  fontFamily: textStyle.fontFamily,
  textAlign: textStyle.textAlign,
};

const vitalsFontReady = textStyle.fontLoadName
  ? document.fonts.load(`${renderSettings.fontSize}px ${textStyle.fontLoadName}`)
  : Promise.resolve();

// Вертикальная метрика шрифта (descender) считается один раз и переиспользуется:
// иначе первый рендер и последующие апдейты могут дать разный padTop → текст
// «прыгает» по высоте.
let cachedDescenderPad = null;

/** @param {number | string} letterSpacing @param {number} fontSize */
function resolveLetterSpacing(letterSpacing, fontSize) {
  if (typeof letterSpacing === 'number') {
    return `${letterSpacing}px`;
  }

  const percentMatch = /^(-?\d+(?:\.\d+)?)%$/.exec(letterSpacing.trim());
  if (percentMatch) {
    const px = (Number(percentMatch[1]) / 100) * fontSize;
    return `${px}px`;
  }

  return letterSpacing;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {string[]} lines
 */
async function paintVitalsCanvas(canvas, ctx, lines) {
  await vitalsFontReady;

  const {
    fontSize, fontFamily, color, textAlign, lineSpacing, lineHeight,
    letterSpacing = 0,
  } = renderSettings;

  const font = `${fontSize}px ${fontFamily}`;
  const letterSpacingCss = resolveLetterSpacing(letterSpacing, fontSize);
  const rowPx = Math.ceil(fontSize * lineSpacing);

  ctx.font = font;
  ctx.letterSpacing = letterSpacingCss;
  let maxW = 1;
  for (const ln of lines) {
    const w = ctx.measureText(ln || ' ').width;
    if (w > maxW) maxW = w;
  }

  if (cachedDescenderPad == null) {
    const sampleMetrics = ctx.measureText('Mg');
    cachedDescenderPad = Math.ceil(sampleMetrics.actualBoundingBoxDescent || fontSize * 0.12);
  }
  const descenderPad = cachedDescenderPad;
  const rowOverflow = Math.max(0, (fontSize - rowPx) / 2);
  const padX = Math.ceil(fontSize * 0.04);
  const padTop = Math.ceil(rowOverflow + descenderPad * 0.25);
  const padBottom = Math.ceil(rowOverflow + descenderPad);

  const canvasW = Math.ceil(maxW) + padX * 2;
  const canvasH = lines.length * rowPx + padTop + padBottom;

  canvas.width = canvasW;
  canvas.height = canvasH;

  ctx.font = font;
  ctx.letterSpacing = letterSpacingCss;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = textAlign;
  ctx.clearRect(0, 0, canvasW, canvasH);

  const textX = textAlign === 'center' ? canvasW / 2 : padX;

  lines.forEach((ln, i) => {
    const y = padTop + i * rowPx + (rowPx - fontSize) / 2;
    ctx.fillText(ln || '', textX, y);
  });

  const pxPerWorld = rowPx / lineHeight;

  return {
    canvasW,
    canvasH,
    worldW: canvasW / pxPerWorld,
    worldH: canvasH / pxPerWorld,
  };
}

/**
 * Плоская панель: canvas + PlaneGeometry, парентится к модели.
 */
class VitalsPanel {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.anisotropy = 16;
    this.texture.generateMipmaps = false;

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Анкер «левый-верхний угол»: вершины плоскости от (0, 0) до (1, -1).
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.geometry.translate(0.5, -0.5, 0);

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.visible = false;
  }

  async setLines(lines) {
    const { worldW, worldH, canvasW, canvasH } = await paintVitalsCanvas(this.canvas, this.ctx, lines);

    // WebGL2 выделяет неизменяемое хранилище под размер канваса при первой загрузке;
    // при смене размеров нужно пересоздать текстуру, иначе обновление не видно.
    if (canvasW !== this._texW || canvasH !== this._texH) {
      this.texture.dispose();
      this._texW = canvasW;
      this._texH = canvasH;
    }

    this.texture.needsUpdate = true;
    this.mesh.scale.set(worldW, worldH, 1);
    this.mesh.visible = true;
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}

/**
 * Открытый цилиндр: текстура один раз по дуге на внутренней стенке.
 */
class VitalsCylinder {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.anisotropy = 16;
    this.texture.generateMipmaps = false;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: layout.opacity,
      depthWrite: false,
      side: THREE.BackSide,
    });

    this.geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.visible = false;
    this.mesh.renderOrder = -1;
  }

  async setLines(lines) {
    const { worldW, worldH, canvasW, canvasH } = await paintVitalsCanvas(this.canvas, this.ctx, lines);
    const { radius, segments } = layout;

    // WebGL2 выделяет неизменяемое хранилище под размер канваса при первой загрузке;
    // при смене размеров нужно пересоздать текстуру, иначе обновление не видно.
    if (canvasW !== this._texW || canvasH !== this._texH) {
      this.texture.dispose();
      this._texW = canvasW;
      this._texH = canvasH;
    }

    this.texture.needsUpdate = true;

    const thetaLength = Math.min(worldW / radius, Math.PI * 2);
    const thetaStart = Math.PI - thetaLength / 2;

    this.texture.repeat.set(1, 1);
    this.texture.offset.set(0, 0);
    this.texture.repeat.x = -1;
    this.texture.offset.x = 1;

    this.geometry.dispose();
    this.geometry = new THREE.CylinderGeometry(
      radius, radius, worldH,
      segments, 1, /* openEnded */ true,
      thetaStart, thetaLength,
    );
    this.mesh.geometry = this.geometry;
    this.mesh.visible = true;
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}

/**
 * @param {{
 *   deviceId?: string,
 *   formatLines?: (data: import('./api.js').LatestResponse | Record<string, unknown>) => string[],
 *   onLines: (lines: string[]) => Promise<void>,
 * }} opts
 */
function subscribeVitals({ deviceId, formatLines, onLines }) {
  async function refresh() {
    try {
      const data = await fetchLatest(VITALS_API_BASE, deviceId);
      const lines = formatLines(data);
      await onLines(lines);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await onLines([`vitals error: ${msg}`]);
    }
  }

  void refresh();
  const es = openVitalsEventSource(VITALS_API_BASE, () => {
    void refresh();
  });

  return () => es.close();
}

/**
 * @param {THREE.Scene} scene
 * @param {{
 *   deviceId?: string,
 *   position?: { x: number, y: number, z: number },
 *   formatLines?: (data: import('./api.js').LatestResponse | Record<string, unknown>) => string[],
 *   modelReady?: Promise<THREE.Object3D>,
 *   model?: THREE.Object3D,
 * }} opts
 */
function initVitalsPlane(scene, opts = {}) {
  const {
    deviceId,
    formatLines = defaultFormatLatestLines,
    modelReady,
    model,
  } = opts;
  const position = opts.position ?? layout.position;

  const group = new THREE.Group();
  const panel = new VitalsPanel();
  group.add(panel.mesh);
  scene.add(group);
  group.position.set(position.x, position.y, position.z);

  function attachToModel(target) {
    if (!target) return;

    target.updateMatrixWorld(true);

    if (group.parent) group.parent.remove(group);
    target.add(group);
    group.position.set(position.x, position.y, position.z);
  }

  if (modelReady && typeof modelReady.then === 'function') {
    modelReady.then(attachToModel);
  } else if (model) {
    attachToModel(model);
  }

  const closeEvents = subscribeVitals({
    deviceId,
    formatLines,
    onLines: (lines) => panel.setLines(lines),
  });

  return {
    root: group,
    dispose() {
      closeEvents();
      if (group.parent) group.parent.remove(group);
      panel.dispose();
    },
  };
}

/**
 * @param {THREE.Scene} scene
 * @param {{
 *   deviceId?: string,
 *   formatLines?: (data: import('./api.js').LatestResponse | Record<string, unknown>) => string[],
 * }} opts
 */
function initVitalsCylinder(scene, opts = {}) {
  const {
    deviceId,
    formatLines = defaultFormatLatestLines,
  } = opts;

  const cylinder = new VitalsCylinder();
  cylinder.mesh.position.y = layout.y;
  scene.add(cylinder.mesh);

  const closeEvents = subscribeVitals({
    deviceId,
    formatLines,
    onLines: (lines) => cylinder.setLines(lines),
  });

  return {
    root: cylinder.mesh,
    dispose() {
      closeEvents();
      scene.remove(cylinder.mesh);
      cylinder.dispose();
    },
  };
}

/**
 * @param {THREE.Scene} scene
 * @param {{
 *   deviceId?: string,
 *   position?: { x: number, y: number, z: number },
 *   formatLines?: (data: import('./api.js').LatestResponse | Record<string, unknown>) => string[],
 *   modelReady?: Promise<THREE.Object3D>,
 *   model?: THREE.Object3D,
 * }} [opts]
 * @returns {{ root: THREE.Object3D, dispose: () => void }}
 */
export function initVitals3D(scene, opts = {}) {
  return VITALS_LAYOUT === 'plane'
    ? initVitalsPlane(scene, opts)
    : initVitalsCylinder(scene, opts);
}
