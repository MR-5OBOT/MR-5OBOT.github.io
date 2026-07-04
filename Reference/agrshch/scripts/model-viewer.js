import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import {
  getPointCloudFormat,
  loadQuantizedNpzPointCloud,
} from './loaders/npz-point-cloud.js';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
 || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);


// ─────────────────────────────────────────────
//  НАСТРОЙКИ МОДЕЛИ — меняй значения здесь
// ─────────────────────────────────────────────

const MODEL = {
  // Облако точек: .ply или .npz (формат определяется по расширению path)
  path: './me/5_25_2026-OPT_xyz_quantized_uint16.npz',

  // Смещение модели после центрирования (x, y, z)
  // Положительный y — вверх, x — вправо, z — к камере
  offset: { 
    x: 0, 
    y: isMobile ? -0.6 : -1.0, 
    z: isMobile ? -0.5 : 0 },

  // Масштаб модели (1 = оригинальный размер)
  scale: isMobile ? 2.2 : 3.0,

  // Поворот модели в градусах (начальное положение)
  rotation: { x: 0, y: 0, z: 0 },

  // Следование за курсором (OrbitControls, горизонтальный азимут)
  // maxAngle — максимальный угол отклонения в градусах
  // smoothing — плавность (0–1, меньше = плавнее)
  cursorFollow: { enabled: true, maxAngle: 30, smoothing: 0.005 },

  // Размер AABB после geometry.rotateX(π), до центрирования и scale.
  // Снято с me/5_25_2026-OPT_xyz_quantized_uint16.npz (тот же path, что выше).
  previewSize: {
    x: 2.5675206184387207,
    y: 1.599712610244751,
    z: 2.560093879699707,
  },
};

// ─────────────────────────────────────────────
//  НАСТРОЙКИ ОБЛАКА ТОЧЕК
// ─────────────────────────────────────────────

const POINT_CLOUD = {
  // Размер точки (в world units, если sizeAttenuation=true)
  size: 0.002,

  // Уменьшать ли точки с расстоянием
  sizeAttenuation: true,

  // Цвет всех точек (цвета из файла игнорируются)
  color: isMobile ? 0xff0000 : 0xff0000,
};

// ─────────────────────────────────────────────
//  НАСТРОЙКИ КАМЕРЫ
// ─────────────────────────────────────────────

const CAMERA = {
  fov: 55,
  near: 0.01,
  far: 1000,

  // Множитель дистанции камеры от модели (больше = дальше)
  distanceMultiplier: 2.2,

  // Высота камеры: доля от высоты модели
  heightFraction: isMobile ? 1.62 : 2,

  // Куда камера смотрит: доля от высоты модели
  targetHeightFraction: 0.58,

  // Начальный поворот OrbitControls (градусы от авто-позиции)
  initialAzimuth: isMobile ? 0 : -5,
  initialPolar: isMobile ? -30 : 0,
};

// ─────────────────────────────────────────────
//  ПРЕДЕЛЫ ВРАЩЕНИЯ (OrbitControls)
// ─────────────────────────────────────────────

const ROTATION_LIMITS = {
  // Горизонтальное вращение (вокруг вертикальной оси)
  // null = без ограничений; значения в градусах
  minAzimuth: -45,
  maxAzimuth: 45,

  // Вертикальное вращение (вверх-вниз)
  // 0° = строго сверху, 180° = строго снизу
  minPolar: 60,
  maxPolar: 110,

  // Зум: множители от автодистанции (0.1 = очень близко, 5 = очень далеко)
  minDistanceMult: 1,
  maxDistanceMult: 1,

  // Демпфирование (плавность вращения)
  enableDamping: true,
  dampingFactor: 0.03,

  // Разрешить панорамирование (сдвиг) правой кнопкой
  enablePan: false,
};

// ─────────────────────────────────────────────
//  РЕНДЕРЕР
// ─────────────────────────────────────────────

const RENDERER = {
  antialias: true,
  maxPixelRatio: 2,
};








// ═════════════════════════════════════════════
//  РЕАЛИЗАЦИЯ
// ═════════════════════════════════════════════

const deg = (d) => d * (Math.PI / 180);

const _cameraOffset = new THREE.Vector3();
const _cameraSpherical = new THREE.Spherical();

let scene, renderer, camera, controls;
let loadedModel = null;
let mouseX = 0;
let baseAzimuth = 0;
let targetAzimuthOffset = 0;
let currentAzimuthOffset = 0;
let userInteracting = false;

let modelReadyResolve;
const modelReadyPromise = new Promise((resolve) => {
  modelReadyResolve = resolve;
});

function createRenderer() {
  renderer = new THREE.WebGLRenderer({
    antialias: RENDERER.antialias,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDERER.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);
}

function createCamera() {
  camera = new THREE.PerspectiveCamera(
    CAMERA.fov,
    window.innerWidth / window.innerHeight,
    CAMERA.near,
    CAMERA.far,
  );
}

function createControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = ROTATION_LIMITS.enableDamping;
  controls.dampingFactor = ROTATION_LIMITS.dampingFactor;
  controls.enablePan = ROTATION_LIMITS.enablePan;

  if (ROTATION_LIMITS.minAzimuth !== null) {
    controls.minAzimuthAngle = deg(ROTATION_LIMITS.minAzimuth);
  }
  if (ROTATION_LIMITS.maxAzimuth !== null) {
    controls.maxAzimuthAngle = deg(ROTATION_LIMITS.maxAzimuth);
  }

  controls.minPolarAngle = deg(ROTATION_LIMITS.minPolar);
  controls.maxPolarAngle = deg(ROTATION_LIMITS.maxPolar);

  controls.addEventListener('start', () => {
    userInteracting = true;
  });
  controls.addEventListener('end', () => {
    userInteracting = false;
    baseAzimuth = controls.getAzimuthalAngle() - currentAzimuthOffset;
  });
}

/** @param {{ x: number, y: number, z: number }} size — как Box3.getSize() до scale модели */
function applyCameraFromSize(size) {
  const maxDim = Math.max(size.x, size.y, size.z);
  const fovRad = camera.fov * (Math.PI / 180);
  const dist = (maxDim / 2) / Math.tan(fovRad / 2) * CAMERA.distanceMultiplier;

  camera.position.set(0, size.y * CAMERA.heightFraction, dist);
  controls.target.set(0, size.y * CAMERA.targetHeightFraction, 0);

  controls.minDistance = dist * ROTATION_LIMITS.minDistanceMult;
  controls.maxDistance = dist * ROTATION_LIMITS.maxDistanceMult;
  controls.update();
  applyOrbitOffset(deg(CAMERA.initialAzimuth), deg(CAMERA.initialPolar));
  baseAzimuth = controls.getAzimuthalAngle();
}

function initPreviewCamera() {
  applyCameraFromSize(MODEL.previewSize);
}

function setupModel(model) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  model.position.sub(center);
  model.position.y += size.y / 2;

  model.position.x += MODEL.offset.x;
  model.position.y += MODEL.offset.y;
  model.position.z += MODEL.offset.z;

  model.scale.setScalar(MODEL.scale);

  model.rotation.x = deg(MODEL.rotation.x);
  model.rotation.y = deg(MODEL.rotation.y);
  model.rotation.z = deg(MODEL.rotation.z);

  scene.add(model);
  loadedModel = model;

  applyCameraFromSize(size);

  document.getElementById('loading')?.classList.add('hidden');

  modelReadyResolve(model);
}

function onLoadError(err) {
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Failed to load model';
  console.error(err);
}

function setupPointCloud(geometry) {
  // Облако часто экспортируется с Y-вниз — переворачиваем на 180° вокруг X.
  geometry.rotateX(Math.PI);

  // Сохраняем исходные позиции, чтобы каждый кадр считать смещения
  // относительно них (а не накапливать ошибки в основном буфере).
  geometry.userData.originalPositions = new Float32Array(
    geometry.attributes.position.array,
  );

  const material = new THREE.PointsMaterial({
    size: POINT_CLOUD.size,
    sizeAttenuation: POINT_CLOUD.sizeAttenuation,
    color: POINT_CLOUD.color,
  });

  setupModel(new THREE.Points(geometry, material));
}

function loadPlyModel(path) {
  const loader = new PLYLoader();

  loader.load(
    path,
    (geometry) => setupPointCloud(geometry),
    undefined,
    onLoadError,
  );
}

function loadNpzModel(path) {
  loadQuantizedNpzPointCloud(path)
    .then((geometry) => setupPointCloud(geometry))
    .catch(onLoadError);
}

function loadModel() {
  const format = getPointCloudFormat(MODEL.path);

  if (format === 'npz') {
    loadNpzModel(MODEL.path);
    return;
  }

  if (format === 'ply') {
    loadPlyModel(MODEL.path);
    return;
  }

  onLoadError(new Error(`Unsupported point cloud format in path: ${MODEL.path}`));
}

// ─────────────────────────────────────────────
//  АНИМАЦИЯ ТОЧЕК
// ─────────────────────────────────────────────
//
//  Доступно внутри цикла:
//    i              — индекс точки (0 .. count-1)
//    ox, oy, oz     — исходная позиция точки (НЕ менять)
//    t              — время в секундах с момента старта
//    count          — общее число точек
//
//  Запиши результат в pos[ix], pos[ix+1], pos[ix+2].
//  Координаты — в локальной системе модели (до scale/rotation).
//
function updatePointPositions(t) {
  const geom = loadedModel.geometry;
  const pos = geom.attributes.position.array;
  const orig = geom.userData.originalPositions;
  const count = geom.attributes.position.count;

  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    const ox = orig[ix];
    const oy = orig[ix + 1];
    const oz = orig[ix + 2];

    // const k = Math.tan(i*0.001+t*0.003)*0.0025;
    pos[ix]     = ox;
    pos[ix + 1] = oy;// + k;
    pos[ix + 2] = oz;
  }

  geom.attributes.position.needsUpdate = true;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
}

function clampSphericalAngles(spherical) {
  if (ROTATION_LIMITS.minAzimuth !== null) {
    spherical.theta = Math.max(deg(ROTATION_LIMITS.minAzimuth), spherical.theta);
  }
  if (ROTATION_LIMITS.maxAzimuth !== null) {
    spherical.theta = Math.min(deg(ROTATION_LIMITS.maxAzimuth), spherical.theta);
  }
  spherical.phi = Math.max(
    controls.minPolarAngle,
    Math.min(controls.maxPolarAngle, spherical.phi),
  );
  spherical.makeSafe();
}

/** Смещает камеру вокруг controls.target по сферическим углам (относительно текущей позиции). */
function applyOrbitOffset(azimuthOffset = 0, polarOffset = 0) {
  _cameraOffset.copy(camera.position).sub(controls.target);
  _cameraSpherical.setFromVector3(_cameraOffset);
  _cameraSpherical.theta += azimuthOffset;
  _cameraSpherical.phi += polarOffset;
  clampSphericalAngles(_cameraSpherical);
  _cameraOffset.setFromSpherical(_cameraSpherical);
  camera.position.copy(controls.target).add(_cameraOffset);
  camera.lookAt(controls.target);
  controls.update();
}

/** Задаёт горизонтальный азимут камеры вокруг controls.target (без доступа к internals OrbitControls). */
function applyAzimuthAngle(angle) {
  _cameraOffset.copy(camera.position).sub(controls.target);
  _cameraSpherical.setFromVector3(_cameraOffset);
  _cameraSpherical.theta = angle;
  clampSphericalAngles(_cameraSpherical);
  _cameraOffset.setFromSpherical(_cameraSpherical);
  camera.position.copy(controls.target).add(_cameraOffset);
  camera.lookAt(controls.target);
}

function animate() {
  requestAnimationFrame(animate);

  if (loadedModel) {
    // const t = performance.now() * 0.001;

    // updatePointPositions(t);

    if (MODEL.cursorFollow.enabled && !userInteracting) {
      const { maxAngle, smoothing } = MODEL.cursorFollow;
      targetAzimuthOffset = mouseX * deg(maxAngle);
      currentAzimuthOffset += (targetAzimuthOffset - currentAzimuthOffset) * smoothing;
      applyAzimuthAngle(baseAzimuth + currentAzimuthOffset);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

// ─────────────────────────────────────────────
//  ЭКСПОРТ — вызывай init() из index.js
// ─────────────────────────────────────────────

export function init3Dmodel() {
  scene = new THREE.Scene();
  createRenderer();
  createCamera();
  createControls();
  initPreviewCamera();
  loadModel();
  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMouseMove);
  animate();

  return { scene, camera, renderer, modelReady: modelReadyPromise };
}
