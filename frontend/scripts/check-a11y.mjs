#!/usr/bin/env node
/**
 * Runs axe-core against the actual built pages (DESIGN.md §8: "No automated contrast or
 * a11y tooling has been run... add axe against the built pages... so the ratios already
 * written into the comments become asserted rather than recorded.").
 *
 * Serves `out/` (produced by `npm run build`) from a plain Node static file server —
 * built WITHOUT NEXT_PUBLIC_BASE_PATH, unlike the real deploy, so pages resolve cleanly
 * at "/" for testing; basePath only rewrites asset URLs, it does not change the DOM/ARIA
 * tree axe inspects, so this is not a gap in what gets checked.
 *
 * Covers the routes that render without needing the Pyodide engine to boot (a live
 * calculation would make this slow and network-flaky in CI): "/" — which, since the seed
 * flow is now a pre-authored static EstateFlow (DESIGN.md build order step 4), already
 * exercises real derivation markup, not an empty shell — and "/references/".
 *
 * Fails the build on any "serious" or "critical" axe violation. "minor"/"moderate" are
 * printed, not enforced — several axe rules in that tier are judgment calls this project
 * has already made deliberately (documented in globals.css's own code comments), and a
 * hard gate on subjective rules would be noise, not signal.
 *
 * Run: node scripts/check-a11y.mjs   (after `npm run build`)
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "..", "out");
const PORT = 4173;

const ROUTES = ["/", "/references/"];
const FAIL_IMPACTS = new Set(["serious", "critical"]);

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".wasm": "application/wasm", ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon", ".whl": "application/octet-stream", ".zip": "application/zip",
};

function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split("?")[0]);
      if (reqPath.endsWith("/")) reqPath += "index.html";
      const filePath = path.join(OUT_DIR, reqPath);
      if (!filePath.startsWith(OUT_DIR)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end("Not found: " + reqPath); return; }
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(PORT, () => resolve(server));
    server.on("error", reject);
  });
}

if (!fs.existsSync(OUT_DIR)) {
  console.error(`${OUT_DIR} does not exist. Run: npm run build`);
  process.exit(1);
}

const server = await serve();
const browser = await chromium.launch();
// @axe-core/playwright requires a page created from an explicit browser.newContext() —
// browser.newPage() shorthand throws "Please use browser.newContext()" from inside axe's
// own analyze() (it needs to reach back to the context to inject its script).
const context = await browser.newContext();
let failures = 0;

try {
  for (const route of ROUTES) {
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "networkidle" });
    const results = await new AxeBuilder({ page }).analyze();
    await page.close();

    const serious = results.violations.filter((v) => FAIL_IMPACTS.has(v.impact));
    const other = results.violations.filter((v) => !FAIL_IMPACTS.has(v.impact));

    console.log(`\n${route} — ${results.violations.length} violation(s) (${results.passes.length} rules passed)`);
    for (const v of other) {
      console.log(`  note [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
    }
    for (const v of serious) {
      failures++;
      console.error(`  FAIL [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
      for (const node of v.nodes.slice(0, 3)) {
        console.error(`        ${node.target.join(" ")}`);
        console.error(`        ${node.failureSummary?.replace(/\n/g, " ")}`);
        console.error(`        html: ${node.html?.slice(0, 300)}`);
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${failures} serious/critical violation(s) across ${ROUTES.length} route(s).`);
if (failures > 0) process.exit(1);
