"use client";

// What would change this answer — and, just as usefully, what would not.
//
// The app shows one derivation. A derivation you cannot perturb is still being taken on
// faith, and the question a family actually has before a meeting is not only "what is my
// share" but "what happens when someone says 'but what about so-and-so?'". Every row here
// is a real, fully derived calculation of the case with one heir slot moved — not a
// heuristic about hajb.
//
// The inert list is the more valuable half and the reason this exists: a result shows who
// WAS blocked in the case as entered, and never shows that most heir slots change nothing
// at all given the others. That structure is the actual content of faraid and it was
// invisible.
//
// Loaded on demand. It is roughly thirty extra engine runs, and it answers a question the
// user has to ask before it is worth spending them.

import { useState } from "react";
import {
  CalculationError,
  CalculationRequest,
  Mode,
  Sensitivity,
  SensitivityRow,
  sensitivity as fetchSensitivity,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui";

function Delta({ row }: { row: SensitivityRow }) {
  const { t } = useI18n();
  return (
    <ul className="sens-delta">
      {row.changed.map((c) => (
        <li key={c.relation}>
          <span className="sd-name">{c.label}</span>
          <span className="sd-move">
            <span className="sd-from">{c.from ? c.from.text : t("sens_none")}</span>
            <Icon name="arrow" size={12} />
            <span className="sd-to">{c.to ? c.to.text : t("sens_none")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function RowItem({ row }: { row: SensitivityRow }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  // "Tanpa X" / "Jika ada X" — the two questions people actually ask, phrased as
  // hypotheticals rather than as instructions to go and verify anything.
  const question = t(row.direction === "remove" ? "sens_q_remove" : "sens_q_add").replace(
    "{heir}",
    row.label
  );

  if (row.status === "no_change") {
    return (
      <li className="sens-row sens-inert">
        <span className="sens-q">{question}</span>
        <span className="sens-verdict">
          {row.blocked_by
            ? t("sens_blocked_by").replace("{by}", row.blocked_by)
            : t("sens_no_change")}
        </span>
      </li>
    );
  }

  if (row.status !== "changes") {
    return (
      <li className="sens-row sens-refused">
        <span className="sens-q">{question}</span>
        <span className="sens-verdict">{t("sens_refused")}</span>
        {row.detail && <span className="sens-detail">{row.detail}</span>}
      </li>
    );
  }

  return (
    <li className="sens-row sens-changing">
      <button className="sens-head" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="chevron" size={14} className={open ? "rot" : undefined} />
        <span className="sens-q">{question}</span>
        <span className="sens-verdict strong">
          {t("sens_changes").replace("{n}", String(row.changed.length))}
        </span>
      </button>
      {open && <Delta row={row} />}
    </li>
  );
}

export default function SensitivityPanel({
  request,
  mode,
}: {
  request: CalculationRequest;
  mode: Mode;
}) {
  const { t, lang } = useI18n();
  const [data, setData] = useState<Sensitivity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      setData(await fetchSensitivity(request, mode, lang));
    } catch (err) {
      setError(err instanceof CalculationError ? err.message : t("server_error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="res-section-title">
        <span className="ico"><Icon name="branch" size={16} /></span>
        {t("sens_title")}
      </div>
      <p className="small muted" style={{ marginBottom: "var(--sp-2)" }}>{t("sens_lede")}</p>

      {!data && (
        <button className="btn btn-secondary btn-sm" type="button" onClick={load} disabled={busy}>
          {busy ? t("sens_running") : <><Icon name="sparkles" size={15} /> {t("sens_run")}</>}
        </button>
      )}

      {error && <div className="sens-error">{error}</div>}

      {data && (
        <>
          {/* Inert first. It is the answer to the question that actually gets asked at a
              family meeting, and the one a single result can never give. */}
          {data.inert.length > 0 && (
            <div className="sens-group">
              <div className="sens-group-head">
                {t("sens_inert_head").replace("{n}", String(data.inert.length))}
              </div>
              {(() => {
                // A son typically blocks the entire collateral line, which produced seven
                // rows all reading "changes nothing — blocked by Son". Identical verdicts
                // collapse onto the heir who causes them: one statement about the case's
                // structure reads better than seven repetitions of it, and the grouping
                // IS the insight.
                const byBlocker = new Map<string, SensitivityRow[]>();
                const loose: SensitivityRow[] = [];
                for (const r of data.inert) {
                  if (r.blocked_by) {
                    const list = byBlocker.get(r.blocked_by) ?? [];
                    list.push(r);
                    byBlocker.set(r.blocked_by, list);
                  } else loose.push(r);
                }
                return (
                  <ul className="sens-list">
                    {[...byBlocker.entries()].map(([blocker, group]) =>
                      group.length > 1 ? (
                        <li className="sens-row sens-inert sens-grouped" key={blocker}>
                          <span className="sens-q">
                            {t("sens_blocked_group").replace("{by}", blocker)}
                          </span>
                          <span className="sens-verdict">
                            {group.map((g) => g.label).join(" · ")}
                          </span>
                        </li>
                      ) : (
                        group.map((r) => <RowItem key={`${r.direction}:${r.slot}`} row={r} />)
                      )
                    )}
                    {loose.map((r) => <RowItem key={`${r.direction}:${r.slot}`} row={r} />)}
                  </ul>
                );
              })()}
            </div>
          )}

          {data.changing.length > 0 && (
            <div className="sens-group">
              <div className="sens-group-head">
                {t("sens_changing_head").replace("{n}", String(data.changing.length))}
              </div>
              <ul className="sens-list">
                {data.changing.map((r) => <RowItem key={`${r.direction}:${r.slot}`} row={r} />)}
              </ul>
            </div>
          )}

          {data.refused.length > 0 && (
            <div className="sens-group">
              <div className="sens-group-head">
                {t("sens_refused_head").replace("{n}", String(data.refused.length))}
              </div>
              <ul className="sens-list">
                {data.refused.map((r) => <RowItem key={`${r.direction}:${r.slot}`} row={r} />)}
              </ul>
            </div>
          )}

          <p className="sens-foot">{t("sens_foot")}</p>
        </>
      )}
    </div>
  );
}
