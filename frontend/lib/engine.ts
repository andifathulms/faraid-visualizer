"use client";

// In-browser Python runtime.
//
// The site is a static build with no backend, so the rule engine runs in the visitor's
// browser: Pyodide (CPython compiled to WebAssembly) executes the *same* faraid_engine
// and faraid_web packages the Django API runs. Nothing about the fiqh logic is
// reimplemented in TypeScript — a second implementation would need its own validation
// against the test bank, and two implementations drift. This module is only transport.
//
// Everything is served from our own origin (see scripts/prepare-python.mjs); no CDN sits
// in the calculation path.

const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Boot progress, so the UI can explain a multi-second first load instead of hanging. */
export type EngineStage = "idle" | "downloading" | "starting" | "ready" | "error";

export interface EngineState {
  stage: EngineStage;
  error?: string;
}

type Listener = (state: EngineState) => void;

const listeners = new Set<Listener>();
let state: EngineState = { stage: "idle" };

function setState(next: EngineState) {
  state = next;
  listeners.forEach((fn) => fn(state));
}

export function getEngineState(): EngineState {
  return state;
}

export function subscribeEngine(fn: Listener): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

// Minimal structural types for the bits of Pyodide we touch. The real typings ship with
// the npm package, but importing them would pull the Node build into the client bundle.
interface PyodideFS {
  mkdirTree(path: string): void;
  writeFile(path: string, data: string | Uint8Array): void;
}
interface PyodideAPI {
  FS: PyodideFS;
  runPython(code: string): unknown;
  loadPackage(names: string[]): Promise<unknown>;
  unpackArchive(buffer: Uint8Array, format: string, options?: { extractDir?: string }): void;
  globals: { get(name: string): unknown };
}

interface RuntimeManifest {
  engineVersion: string;
  reportlabWheel: string;
  pdfPackages: string[];
}

type DispatchFn = (action: string, requestJson: string) => string;

let enginePromise: Promise<DispatchFn> | null = null;
let pdfPromise: Promise<void> | null = null;
let pyodide: PyodideAPI | null = null;
let manifest: RuntimeManifest | null = null;

async function loadManifest(): Promise<RuntimeManifest> {
  if (manifest) return manifest;
  const res = await fetch(`${ASSET_BASE}/py/runtime.json`);
  if (!res.ok) throw new Error(`Could not load runtime manifest (HTTP ${res.status})`);
  manifest = (await res.json()) as RuntimeManifest;
  return manifest;
}

async function boot(): Promise<DispatchFn> {
  setState({ stage: "downloading" });

  // webpackIgnore keeps the bundler from trying to resolve the vendored runtime at build
  // time — it is a static asset fetched at runtime, not a module in the dependency graph.
  const pyodideModule = await import(
    /* webpackIgnore: true */ `${ASSET_BASE}/pyodide/pyodide.mjs`
  );

  const [{ version, files }, meta] = await Promise.all([
    fetch(`${ASSET_BASE}/py/faraid-python.json`).then((r) => {
      if (!r.ok) throw new Error(`Could not load the rule engine (HTTP ${r.status})`);
      return r.json() as Promise<{ version: string; files: Record<string, string> }>;
    }),
    loadManifest(),
  ]);

  setState({ stage: "starting" });
  const py: PyodideAPI = await pyodideModule.loadPyodide({
    indexURL: `${ASSET_BASE}/pyodide/`,
  });

  // Write the engine into Pyodide's virtual filesystem and put it on sys.path.
  py.FS.mkdirTree("/faraid");
  for (const [filePath, source] of Object.entries(files)) {
    const dir = filePath.split("/").slice(0, -1).join("/");
    if (dir) py.FS.mkdirTree(`/faraid/${dir}`);
    py.FS.writeFile(`/faraid/${filePath}`, source);
  }

  py.runPython(`
import sys
sys.path.insert(0, "/faraid")
from faraid_web.bridge import dispatch
`);

  const dispatch = py.globals.get("dispatch") as DispatchFn;
  if (typeof dispatch !== "function") {
    throw new Error("Rule engine loaded but exposed no dispatch entrypoint.");
  }

  pyodide = py;
  if (version !== meta.engineVersion) {
    // Stale cache: the sources and the manifest came from different builds. Not fatal —
    // the engine that actually loaded is the one we just hashed — but worth surfacing.
    console.warn(
      `[faraid] engine bundle ${version} does not match manifest ${meta.engineVersion}; a cached asset may be stale.`
    );
  }
  setState({ stage: "ready" });
  return dispatch;
}

/**
 * Start (or join) the engine boot. Safe to call repeatedly — one boot per page load.
 *
 * Call this early: the runtime is ~13 MB, and a visitor typically spends 15-30s entering
 * heirs, which is enough to hide the download entirely.
 */
export function preloadEngine(): Promise<DispatchFn> {
  if (!enginePromise) {
    enginePromise = boot().catch((err) => {
      // Reset so a transient network failure can be retried rather than poisoning the
      // page until reload.
      enginePromise = null;
      const message = err instanceof Error ? err.message : String(err);
      setState({ stage: "error", error: message });
      throw err;
    });
  }
  return enginePromise;
}

/** Response envelope produced by faraid_web.bridge.dispatch. */
export type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "invalid_input" | "unsupported" | "engine_error"; error: string; detail: unknown };

/** Mirrors faraid_web.bridge.ACTIONS — keep in sync with that tuple. */
export type EngineAction = "calculate" | "compare" | "pdf" | "sensitivity" | "sources";

export async function callEngine<T>(
  action: EngineAction,
  request: Record<string, unknown>
): Promise<Envelope<T>> {
  const dispatch = await preloadEngine();
  return JSON.parse(dispatch(action, JSON.stringify(request))) as Envelope<T>;
}

/**
 * Load the PDF renderer on demand (~2.9 MB: reportlab + Pillow).
 *
 * Deliberately not part of the boot path — most visitors never export, and this would
 * otherwise more than double the wait before the first calculation. reportlab is pure
 * Python so its wheel is unpacked straight onto sys.path; only Pillow, which reportlab
 * imports unconditionally, needs Pyodide's package loader.
 */
export function ensurePdfSupport(): Promise<void> {
  if (!pdfPromise) {
    pdfPromise = (async () => {
      await preloadEngine();
      const py = pyodide;
      const meta = await loadManifest();
      if (!py) throw new Error("Rule engine is not ready.");

      await py.loadPackage(meta.pdfPackages);

      const res = await fetch(`${ASSET_BASE}/pyodide/${meta.reportlabWheel}`);
      if (!res.ok) throw new Error(`Could not load the PDF renderer (HTTP ${res.status})`);
      py.unpackArchive(new Uint8Array(await res.arrayBuffer()), "zip", {
        extractDir: "/wheels",
      });
      py.runPython(`
import sys
if "/wheels" not in sys.path:
    sys.path.insert(0, "/wheels")
`);
    })().catch((err) => {
      pdfPromise = null;
      throw err;
    });
  }
  return pdfPromise;
}
