import * as THREE from 'three';
import { unzipSync } from 'fflate';

const QUANTIZE_DIVISOR = 65535;

function parseNpy(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.length < 10 || bytes[0] !== 0x93 || bytes[1] !== 0x4e) {
    throw new Error('Invalid NPY file');
  }

  const major = bytes[6];
  const headerLen = major === 1
    ? view.getUint16(8, true)
    : view.getUint32(8, true);
  const headerStart = major === 1 ? 10 : 12;
  const headerText = new TextDecoder('latin1').decode(
    bytes.subarray(headerStart, headerStart + headerLen),
  );

  const descrMatch = headerText.match(/'descr':\s*'([^']+)'/);
  const shapeMatch = headerText.match(/'shape':\s*\(([^)]*)\)/);
  if (!descrMatch || !shapeMatch) {
    throw new Error('Unsupported NPY header');
  }

  const descr = descrMatch[1];
  const shape = shapeMatch[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number);

  const dataOffset = headerStart + headerLen;
  return { descr, shape, data: bytes.subarray(dataOffset) };
}

function readFloat32Vector(npy) {
  if (npy.descr !== '<f4' || npy.shape.length !== 1 || npy.shape[0] !== 3) {
    throw new Error('Expected min_xyz/scale_xyz as float32[3]');
  }
  const view = new DataView(npy.data.buffer, npy.data.byteOffset, npy.data.byteLength);
  return [
    view.getFloat32(0, true),
    view.getFloat32(4, true),
    view.getFloat32(8, true),
  ];
}

function dequantizePoints(pointsNpy, minXyz, scaleXyz) {
  if (pointsNpy.descr !== '<u2' || pointsNpy.shape.length !== 2 || pointsNpy.shape[1] !== 3) {
    throw new Error('Expected points_q_uint16 as uint16[N, 3]');
  }

  const count = pointsNpy.shape[0];
  const positions = new Float32Array(count * 3);
  const view = new DataView(pointsNpy.data.buffer, pointsNpy.data.byteOffset, pointsNpy.data.byteLength);
  const inv = 1 / QUANTIZE_DIVISOR;

  for (let i = 0; i < count; i++) {
    const base = i * 6;
    const qx = view.getUint16(base, true);
    const qy = view.getUint16(base + 2, true);
    const qz = view.getUint16(base + 4, true);
    const ix = i * 3;

    positions[ix] = minXyz[0] + qx * inv * scaleXyz[0];
    positions[ix + 1] = minXyz[1] + qy * inv * scaleXyz[1];
    positions[ix + 2] = minXyz[2] + qz * inv * scaleXyz[2];
  }

  return positions;
}

function decodeNpzArchive(buffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const pointsNpy = parseNpy(files['points_q_uint16.npy']);
  const minXyz = readFloat32Vector(parseNpy(files['min_xyz.npy']));
  const scaleXyz = readFloat32Vector(parseNpy(files['scale_xyz.npy']));

  return dequantizePoints(pointsNpy, minXyz, scaleXyz);
}

export function getPointCloudFormat(path) {
  const ext = path.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'npz') return 'npz';
  if (ext === 'ply') return 'ply';
  return null;
}

export async function loadQuantizedNpzPointCloud(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch NPZ: ${response.status} ${response.statusText}`);
  }

  const positions = decodeNpzArchive(await response.arrayBuffer());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}
