import * as THREE from "three";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

export const VIEWABLE_MODEL_EXTENSIONS = new Set(["stl", "3mf"]);
export const MAX_AUTOMATIC_MODEL_ANALYSIS_SIZE = 30 * 1024 * 1024;

export type ModelMetadata = {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  volumeMm3: number;
  triangleCount: number;
};

export type ModelAnalysis = {
  metadata: ModelMetadata;
  preview: Blob | null;
};

export function isViewableModelExtension(extension: string): boolean {
  return VIEWABLE_MODEL_EXTENSIONS.has(extension.toLowerCase());
}

function normalizeModel(object: THREE.Object3D): void {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);

  if (box.isEmpty()) {
    return;
  }

  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  object.updateMatrixWorld(true);

  const centeredBox = new THREE.Box3().setFromObject(object);
  object.position.y -= centeredBox.min.y;
  object.updateMatrixWorld(true);
}

export function parseModel(
  data: ArrayBuffer,
  extension: string,
): THREE.Object3D {
  const normalizedExtension = extension.toLowerCase();

  if (normalizedExtension === "stl") {
    const geometry = new STLLoader().parse(data);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    const material = new THREE.MeshStandardMaterial({
      color: 0xf28c28,
      roughness: 0.62,
      metalness: 0.08,
      side: THREE.DoubleSide,
      vertexColors: geometry.hasAttribute("color"),
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    normalizeModel(mesh);
    return mesh;
  }

  if (normalizedExtension === "3mf") {
    const object = new ThreeMFLoader().parse(data);
    object.rotation.x = -Math.PI / 2;
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      child.castShadow = true;
      child.receiveShadow = true;

      if (!child.material) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xf28c28,
          roughness: 0.62,
          metalness: 0.08,
          side: THREE.DoubleSide,
        });
      }
    });
    normalizeModel(object);
    return object;
  }

  throw new Error("Dieses Modellformat wird vom Viewer nicht unterstützt.");
}

export function measureModel(object: THREE.Object3D): ModelMetadata {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  let triangleCount = 0;
  let signedVolume = 0;

  const first = new THREE.Vector3();
  const second = new THREE.Vector3();
  const third = new THREE.Vector3();
  const cross = new THREE.Vector3();

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const geometry = child.geometry;
    const position = geometry.getAttribute("position");

    if (!position) {
      return;
    }

    const index = geometry.getIndex();
    const count = index ? index.count : position.count;
    const usableCount = count - (count % 3);
    triangleCount += usableCount / 3;

    for (let offset = 0; offset < usableCount; offset += 3) {
      const firstIndex = index ? index.getX(offset) : offset;
      const secondIndex = index ? index.getX(offset + 1) : offset + 1;
      const thirdIndex = index ? index.getX(offset + 2) : offset + 2;

      first.fromBufferAttribute(position, firstIndex).applyMatrix4(child.matrixWorld);
      second.fromBufferAttribute(position, secondIndex).applyMatrix4(child.matrixWorld);
      third.fromBufferAttribute(position, thirdIndex).applyMatrix4(child.matrixWorld);
      signedVolume += first.dot(cross.copy(second).cross(third)) / 6;
    }
  });

  return {
    widthMm: Math.max(0, size.x),
    depthMm: Math.max(0, size.z),
    heightMm: Math.max(0, size.y),
    volumeMm3: Math.abs(signedVolume),
    triangleCount,
  };
}

function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const fovRadians = THREE.MathUtils.degToRad(camera.fov);
  const distance = (maxDimension / (2 * Math.tan(fovRadians / 2))) * 1.65;

  camera.position.set(
    center.x + distance * 0.8,
    center.y + distance * 0.65,
    center.z + distance,
  );
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = Math.max(distance * 100, 1000);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png", 0.92);
  });
}

export async function renderModelPreview(
  object: THREE.Object3D,
  width = 960,
  height = 720,
): Promise<Blob | null> {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });

  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x090d11, 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d11);

    // Ein Object3D kann immer nur zu einer Scene gehören. Ein direktes
    // scene.add(object) würde das sichtbare Modell aus dem Live-Viewer lösen.
    // Der Klon teilt nur Geometrien/Materialien und wird hier nicht entsorgt.
    const previewObject = object.clone(true);
    scene.add(previewObject);

    const box = new THREE.Box3().setFromObject(previewObject);
    const size = box.getSize(new THREE.Vector3());
    const gridSize = Math.max(size.x, size.z, 100) * 1.8;
    const grid = new THREE.GridHelper(gridSize, 18, 0x56616c, 0x242b31);
    grid.position.y = 0;
    scene.add(grid);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x17202a, 2.2);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 4.2);
    key.position.set(gridSize, gridSize * 1.4, gridSize);
    key.castShadow = true;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffa54a, 1.7);
    fill.position.set(-gridSize, gridSize * 0.65, -gridSize * 0.5);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(
      42,
      width / height,
      0.01,
      100000,
    );
    fitCameraToObject(camera, previewObject);
    renderer.render(scene, camera);

    return await canvasToBlob(canvas);
  } finally {
    renderer.dispose();
  }
}

export function disposeModel(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    for (const material of materials) {
      material.dispose();
    }
  });
}

export async function analyzeModelBuffer(
  data: ArrayBuffer,
  extension: string,
  includePreview = true,
): Promise<ModelAnalysis> {
  const object = parseModel(data, extension);

  try {
    const metadata = measureModel(object);
    const preview = includePreview
      ? await renderModelPreview(object)
      : null;
    return { metadata, preview };
  } finally {
    disposeModel(object);
  }
}

export async function analyzeModelFile(
  file: File,
  extension: string,
  includePreview = true,
): Promise<ModelAnalysis> {
  return analyzeModelBuffer(
    await file.arrayBuffer(),
    extension,
    includePreview,
  );
}
