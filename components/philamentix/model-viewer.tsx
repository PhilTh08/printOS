"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import {
  disposeModel,
  measureModel,
  parseModel,
  renderModelPreview,
  type ModelMetadata,
} from "@/components/philamentix/model-analyzer";

import styles from "./model-viewer.module.css";

type ModelViewerProps = {
  sourceUrl: string;
  extension: string;
  fileName: string;
  initialMetadata?: ModelMetadata | null;
  analyzeOnLoad?: boolean;
  onAnalyzed?: (metadata: ModelMetadata, preview: Blob | null) => void | Promise<void>;
};

type ViewerRuntime = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  model: THREE.Object3D;
  resizeObserver: ResizeObserver;
  animationFrame: number;
};

function formatDimension(value: number): string {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} mm`;
}

function formatVolume(value: number): string {
  const cubicCentimeters = value / 1000;
  return `${cubicCentimeters.toLocaleString("de-DE", {
    maximumFractionDigits: cubicCentimeters >= 100 ? 0 : 2,
  })} cm³`;
}

function fitCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D,
): void {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const distance =
    (maxDimension /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) *
    1.65;

  camera.position.set(
    center.x + distance * 0.8,
    center.y + distance * 0.65,
    center.z + distance,
  );
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = Math.max(distance * 100, 1000);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

export default function ModelViewer({
  sourceUrl,
  extension,
  fileName,
  initialMetadata = null,
  analyzeOnLoad = true,
  onAnalyzed,
}: ModelViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<ViewerRuntime | null>(null);
  const [metadata, setMetadata] = useState<ModelMetadata | null>(initialMetadata);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wireframe, setWireframe] = useState(false);
  const [savingPreview, setSavingPreview] = useState(false);

  const resetCamera = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    fitCamera(runtime.camera, runtime.controls, runtime.model);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;

    if (!canvas || !viewport) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    async function initialize(
      canvasElement: HTMLCanvasElement,
      viewportElement: HTMLDivElement,
    ) {
      const response = await fetch(sourceUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Die Modelldatei konnte nicht geladen werden.");
      }

      const model = parseModel(await response.arrayBuffer(), extension);
      if (cancelled) {
        disposeModel(model);
        return;
      }

      const renderer = new THREE.WebGLRenderer({
        canvas: canvasElement,
        antialias: true,
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x090d11);
      scene.add(model);

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const gridSize = Math.max(size.x, size.z, 100) * 1.8;
      scene.add(new THREE.GridHelper(gridSize, 18, 0x56616c, 0x242b31));
      scene.add(new THREE.HemisphereLight(0xffffff, 0x17202a, 2.2));

      const key = new THREE.DirectionalLight(0xffffff, 4.2);
      key.position.set(gridSize, gridSize * 1.4, gridSize);
      key.castShadow = true;
      scene.add(key);

      const fill = new THREE.DirectionalLight(0xffa54a, 1.7);
      fill.position.set(-gridSize, gridSize * 0.65, -gridSize * 0.5);
      scene.add(fill);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100000);
      const controls = new OrbitControls(camera, canvasElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.screenSpacePanning = true;
      controls.minDistance = 0.01;
      controls.maxDistance = Math.max(gridSize * 20, 1000);
      fitCamera(camera, controls, model);

      const resize = () => {
        const width = Math.max(viewportElement.clientWidth, 1);
        const height = Math.max(viewportElement.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(viewportElement);
      resize();

      const runtime: ViewerRuntime = {
        renderer,
        scene,
        camera,
        controls,
        model,
        resizeObserver,
        animationFrame: 0,
      };
      runtimeRef.current = runtime;

      const animate = () => {
        controls.update();
        renderer.render(scene, camera);
        runtime.animationFrame = window.requestAnimationFrame(animate);
      };
      animate();

      const measured = measureModel(model);
      setMetadata(measured);
      setLoading(false);

      if (analyzeOnLoad && onAnalyzed) {
        const preview = await renderModelPreview(model);
        if (!cancelled) {
          await onAnalyzed(measured, preview);
        }
      }
    }

    void initialize(canvas, viewport).catch((caughtError) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Der 3D-Viewer konnte nicht gestartet werden.",
      );
    });

    return () => {
      cancelled = true;
      const runtime = runtimeRef.current;
      runtimeRef.current = null;

      if (!runtime) {
        return;
      }

      window.cancelAnimationFrame(runtime.animationFrame);
      runtime.resizeObserver.disconnect();
      runtime.controls.dispose();
      runtime.renderer.dispose();
      disposeModel(runtime.model);
    };
  }, [analyzeOnLoad, extension, onAnalyzed, sourceUrl]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    runtime.model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) {
        if ("wireframe" in material) {
          material.wireframe = wireframe;
          material.needsUpdate = true;
        }
      }
    });
  }, [wireframe]);

  async function regeneratePreview() {
    const runtime = runtimeRef.current;
    if (!runtime || !metadata || !onAnalyzed) {
      return;
    }

    setSavingPreview(true);
    try {
      const preview = await renderModelPreview(runtime.model);
      await onAnalyzed(metadata, preview);
    } finally {
      setSavingPreview(false);
    }
  }

  return (
    <div className={styles.viewer}>
      <div className={styles.viewport} ref={viewportRef}>
        <canvas className={styles.canvas} ref={canvasRef} aria-label={`3D-Vorschau von ${fileName}`} />
        {(loading || error) && (
          <div className={styles.overlay}>
            {loading ? "3D-Modell wird geladen …" : error}
          </div>
        )}
      </div>

      <div className={styles.toolbar}>
        <button className="secondary-button" type="button" onClick={resetCamera}>
          Ansicht zurücksetzen
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setWireframe((current) => !current)}
        >
          {wireframe ? "Flächen anzeigen" : "Drahtgitter"}
        </button>
        {onAnalyzed && (
          <button
            className="secondary-button"
            type="button"
            disabled={savingPreview || !metadata}
            onClick={() => void regeneratePreview()}
          >
            {savingPreview ? "Vorschau wird gespeichert …" : "Vorschau neu erzeugen"}
          </button>
        )}
        <span>Linke Maustaste: drehen · Rad: zoomen · rechte Maustaste: verschieben</span>
      </div>

      {metadata && (
        <div className={styles.metadata}>
          <article>
            <span>Breite</span>
            <strong>{formatDimension(metadata.widthMm)}</strong>
          </article>
          <article>
            <span>Tiefe</span>
            <strong>{formatDimension(metadata.depthMm)}</strong>
          </article>
          <article>
            <span>Höhe</span>
            <strong>{formatDimension(metadata.heightMm)}</strong>
          </article>
          <article>
            <span>Dreiecke</span>
            <strong>{metadata.triangleCount.toLocaleString("de-DE")}</strong>
            <small>{formatVolume(metadata.volumeMm3)}</small>
          </article>
        </div>
      )}
    </div>
  );
}
