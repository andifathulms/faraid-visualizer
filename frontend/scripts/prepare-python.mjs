/**
 * Build-time asset pipeline for the in-browser Python runtime.
 *
 * The static build has no backend, so the browser runs `faraid_engine` + `faraid_web`
 * itself under Pyodide (WebAssembly CPython). This script assembles everything that
 * needs to be served alongside the site:
 *
 *   public/py/faraid-python.json  — every .py source file, as one fetch
 *   public/pyodide/               — the Pyodide runtime, self-hosted
 *   public/pyodide/*.whl          — reportlab + its deps, for PDF export
 *
 * Everything is self-hosted deliberately. Pyodide's default is to pull the runtime and
 * wheels from a third-party CDN at page load; for a tool that produces legal-adjacent
 * documents, the calculation path should not depend on a CDN staying up or serving what
 * we expect. It also keeps the site working offline once cached.
 *
 * Generated output is gitignored — this runs before every build (`npm run prebuild`),
 * locally and in CI, so the shipped Python is always the current backend source.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, "..");
const BACKEND = path.resolve(FRONTEND, "..", "backend");
const PUBLIC = path.join(FRONTEND, "public");

// The packages shipped to the browser. Both are Django-free by construction — that
// invariant is what makes this possible at all (see backend/faraid_web/__init__.py).
const PACKAGES = ["faraid_engine", "faraid_web"];

// reportlab is the only third-party Python dependency, and only for PDF export. It is
// NOT in Pyodide's package lock, so we vendor the pure-Python wheel from PyPI, pinned by
// hash. Version bumps are deliberate: change both fields together.
const REPORTLAB = {
  version: "5.0.0",
  file: "reportlab-5.0.0-py3-none-any.whl",
  url: "https://files.pythonhosted.org/packages/a3/07/70085c17a369605f15e301d10ab902115019b1126c7253d964afc230c7d6/reportlab-5.0.0-py3-none-any.whl",
  sha256: "9d5a3affa84919e1111ede580031266a570e93b1ce388219621347965ff1d93c",
};

// reportlab's runtime dependencies. These ARE in Pyodide's lock, so they ship with the
// npm package's resolution and we copy them from there rather than hitting PyPI.
const REPORTLAB_DEPS = ["pillow", "charset-normalizer"];

// Core Pyodide runtime files. Deliberately explicit: the npm package also contains test
// fixtures and type definitions we have no reason to publish.
const PYODIDE_CORE = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

const log = (msg) => console.log(`[prepare-python] ${msg}`);
const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

/** Recursively collect .py files, excluding test suites (they never run in the browser). */
function collectSources(pkg) {
  const out = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "tests" || entry.name === "__pycache__") continue;
        walk(full);
      } else if (entry.name.endsWith(".py")) {
        out[path.relative(BACKEND, full).split(path.sep).join("/")] = fs.readFileSync(full, "utf8");
      }
    }
  };
  walk(path.join(BACKEND, pkg));
  return out;
}

function buildPythonBundle() {
  let files = {};
  for (const pkg of PACKAGES) {
    const found = collectSources(pkg);
    if (Object.keys(found).length === 0) throw new Error(`No .py files found in ${pkg}`);
    files = { ...files, ...found };
  }

  // A digest of the sources doubles as the cache-busting token: the browser only
  // re-downloads the engine when the engine actually changed.
  const digest = createHash("sha256")
    .update(JSON.stringify(Object.keys(files).sort().map((k) => [k, files[k]])))
    .digest("hex")
    .slice(0, 16);

  const outDir = path.join(PUBLIC, "py");
  fs.mkdirSync(outDir, { recursive: true });
  const body = JSON.stringify({ version: digest, files });
  fs.writeFileSync(path.join(outDir, "faraid-python.json"), body);

  log(`bundled ${Object.keys(files).length} .py files (${mb(body.length)} raw, digest ${digest})`);
  return digest;
}

function resolvePyodideDir() {
  const entry = fileURLToPath(import.meta.resolve("pyodide"));
  return path.dirname(entry);
}

function vendorPyodideCore() {
  const src = resolvePyodideDir();
  const dest = path.join(PUBLIC, "pyodide");
  fs.mkdirSync(dest, { recursive: true });

  let total = 0;
  for (const name of PYODIDE_CORE) {
    const from = path.join(src, name);
    if (!fs.existsSync(from)) throw new Error(`Pyodide runtime file missing: ${from}`);
    fs.copyFileSync(from, path.join(dest, name));
    total += fs.statSync(from).size;
  }
  log(`vendored Pyodide runtime (${mb(total)} across ${PYODIDE_CORE.length} files)`);
  return { src, dest };
}

/**
 * Copy the wheels reportlab needs, resolving exact filenames from Pyodide's lock.
 *
 * The npm package ships the lock but downloads wheels on first use, so a fresh checkout
 * (CI, or a new clone) has none. Booting Pyodide once populates the cache; we do that
 * automatically rather than making the build fail on a missing prerequisite.
 */
async function vendorReportlabDeps(src, dest) {
  const lock = JSON.parse(fs.readFileSync(path.join(src, "pyodide-lock.json"), "utf8"));

  const resolved = REPORTLAB_DEPS.map((dep) => {
    const pkg = lock.packages[dep];
    if (!pkg) throw new Error(`${dep} is not in pyodide-lock.json — Pyodide version changed?`);
    return { dep, file: pkg.file_name };
  });

  if (resolved.some(({ file }) => !fs.existsSync(path.join(src, file)))) {
    await warmWheels();
  }

  for (const { dep, file } of resolved) {
    const from = path.join(src, file);
    if (!fs.existsSync(from)) {
      throw new Error(`Wheel for ${dep} (${file}) still missing after warming the cache.`);
    }
    fs.copyFileSync(from, path.join(dest, file));
  }
  return resolved.map(({ file }) => file);
}

async function vendorReportlab(dest) {
  const target = path.join(dest, REPORTLAB.file);
  if (fs.existsSync(target) && sha256(target) === REPORTLAB.sha256) {
    log(`reportlab ${REPORTLAB.version} already vendored`);
    return;
  }
  log(`downloading reportlab ${REPORTLAB.version}…`);
  const res = await fetch(REPORTLAB.url);
  if (!res.ok) throw new Error(`Failed to download reportlab: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = createHash("sha256").update(buf).digest("hex");
  if (got !== REPORTLAB.sha256) {
    throw new Error(`reportlab checksum mismatch.\n  expected ${REPORTLAB.sha256}\n  got      ${got}`);
  }
  fs.writeFileSync(target, buf);
  log(`vendored ${REPORTLAB.file} (${mb(buf.length)}, checksum verified)`);
}

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** Pre-download the lock-resolved wheels by booting Pyodide once and installing them. */
async function warmWheels() {
  const { loadPyodide } = await import("pyodide");
  log("booting Pyodide to cache reportlab's dependency wheels…");
  const py = await loadPyodide();
  await py.loadPackage(REPORTLAB_DEPS);
  log("wheel cache warmed");
}

const mode = process.argv[2] ?? "build";

if (mode === "warm-wheels") {
  await warmWheels();
} else {
  const digest = buildPythonBundle();
  const { src, dest } = vendorPyodideCore();
  await vendorReportlab(dest);
  const deps = await vendorReportlabDeps(src, dest);
  log(`vendored PDF dependency wheels: ${deps.join(", ")}`);

  // Emit a manifest the app reads at runtime, so filenames are never hardcoded twice.
  fs.writeFileSync(
    path.join(PUBLIC, "py", "runtime.json"),
    JSON.stringify({ engineVersion: digest, reportlabWheel: REPORTLAB.file, pdfDeps: REPORTLAB_DEPS }, null, 2)
  );
  log("done");
}
