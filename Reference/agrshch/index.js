import { init3Dmodel } from './scripts/model-viewer.js';
import { initVitals3D } from './scripts/vitals/vitals-3d.js';

const { scene, modelReady } = init3Dmodel();
initVitals3D(scene, { modelReady });
