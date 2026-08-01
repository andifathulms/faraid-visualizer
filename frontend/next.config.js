/**
 * The frontend is a fully static site — there is no server at runtime.
 *
 * The rule engine runs in the browser under Pyodide (see lib/engine.ts), so the exported
 * output is the complete application: HTML, JS, the Python sources, and the WebAssembly
 * runtime. That is what GitHub Pages serves.
 *
 * `basePath` comes from the environment because a GitHub *project* site is served from a
 * subdirectory (/<repo>), while a local build, a custom domain, or a user site is served
 * from the root. The same value is exposed as NEXT_PUBLIC_BASE_PATH so the runtime can
 * prefix its own asset fetches — Next rewrites URLs in JSX, but not ones we build by
 * hand in fetch()/import().
 */

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  // Directory-style URLs resolve correctly on a plain static host, which has no rewrite
  // rules to fall back on.
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

module.exports = nextConfig;
