// Citation helpers that need no engine.
//
// `citationNote` used to live in lib/api.ts, which imports lib/engine.ts for the Pyodide
// bridge. The references page imports only this one function — and the whole loader came
// with it. Measured in the built bundle before the split:
//
//   $ grep -o "loadPyodide\|pyodide/pyodide.mjs" out/.../app/references/page-*.js
//   loadPyodide
//   pyodide/pyodide.mjs
//
// which is exactly what that page's own header comment says it does not do. The runtime
// was never fetched, but its loader shipped and parsed on a page that only lists 35 rows.
//
// Types are imported `type`-only here so this module pulls in no runtime code at all.

import type { Lang, SourceCitation } from "@/lib/api";

/**
 * The editorial note for a citation in the reader's language.
 *
 * English stays canonical and is the fallback, so a payload without note_id degrades to
 * the previous behaviour rather than to blank.
 */
export function citationNote(src: SourceCitation, lang: Lang): string {
  return (lang === "id" && src.note_id) || src.note;
}
