"use client";

import { useState } from "react";
import { CalculationResult, Share, SourceCitation } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { CategoryChip, Fraction, Icon, ProportionBar, colorFor } from "./ui";

// Data text (labels, categories, reasons, step titles, notes, disclaimer) is server-
// localized; this component supplies static UI chrome + the visual composition.

function Citation({ id, sources }: { id: string; sources: Record<string, SourceCitation> }) {
  const src = sources[id];
  if (!src) return null;
  return (
    <span className="cite" title={`${src.reference}${src.note ? " — " + src.note : ""}`}>
      <Icon name="book" size={11} /> {src.pointer}
    </span>
  );
}

function ShareItem({ share, color, sources, defaultOpen }: {
  share: Share; color: string; sources: Record<string, SourceCitation>; defaultOpen: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const isHb = share.category === "harta_bersama";
  return (
    <div className="share-item">
      <div className="share-main">
        <span className="share-accent" style={{ background: color }} />
        <div className="share-id">
          <div className="share-name">
            {share.label}
            {share.count > 1 && <span className="count-tag">×{share.count}</span>}
          </div>
          <div className="share-meta">
            <CategoryChip category={share.category} label={share.category_label} />
            {share.count > 1 && !isHb && (
              <span className="per-head">@ <Fraction value={share.per_head} />{" "}{t("th_perhead").toLowerCase()}</span>
            )}
          </div>
        </div>
        <div className="share-values">
          {isHb ? <span className="muted small">—</span> : <Fraction value={share.share} className="share-frac-lg" />}
          {share.amount && <span className="share-amount">{share.amount}</span>}
        </div>
        <button className={`why-toggle ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)} aria-label="why">
          <Icon name="chevron" size={16} />
        </button>
      </div>
      {open && (
        <div className="why-body">
          {share.reason} <Citation id={share.source_id} sources={sources} />
        </div>
      )}
    </div>
  );
}

export default function ResultView({ result }: { result: CalculationResult }) {
  const { t } = useI18n();
  const professional = result.mode === "professional";
  const e = result.estate;
  const awarded = result.shares.filter((s) => s.category !== "harta_bersama");
  const hb = result.shares.filter((s) => s.category === "harta_bersama");

  return (
    <div className="stack gap-20">
      {result.beta && (
        <div className="callout callout-warn">
          <span className="c-ico"><Icon name="alert" size={18} /></span>
          <span><b>BETA</b> — {t("beta_warn")}</span>
        </div>
      )}

      {/* Summary + proportion */}
      <div className="result-summary">
        <div className="summary-badges">
          <span className="summary-stat">{t("pokok_masalah")} <b>{result.pokok_masalah}</b></span>
          {result.aul_applied && <span className="badge badge-soft">'aul → {result.aul_base}</span>}
          {result.radd_applied && <span className="badge badge-soft">radd</span>}
          <span className="summary-stat"><b>{awarded.length}</b> {t("th_heir").toLowerCase()}</span>
        </div>
        {awarded.length > 0 && <ProportionBar shares={awarded} />}
        {awarded.length > 0 && (
          <div className="legend">
            {awarded.map((s, i) => (
              <span className="legend-item" key={i}>
                <span className="legend-sw" style={{ background: colorFor(i) }} />
                <span className="lg-name">{s.label}</span>
                <span className="lg-val"><Fraction value={s.share} /></span>
              </span>
            ))}
          </div>
        )}
      </div>

      {e && (e.net_divisible !== e.gross_value || Number(e.harta_bersama_deducted) > 0) && (
        <div className="estate-strip">
          <Icon name="scroll" size={15} />
          <span>{t("divisible_estate")}:</span>
          <span>{e.gross_value} − {e.funeral_costs} − {e.debts} − {e.wasiyya}
            {Number(e.harta_bersama_deducted) > 0 ? ` − ${e.harta_bersama_deducted}` : ""} =</span>
          <b>{e.net_divisible}</b>
        </div>
      )}

      {/* Shares */}
      <div>
        <div className="res-section-title"><span className="ico"><Icon name="scale" size={17} /></span>{t("distribution")}</div>
        <div className="share-list">
          {hb.map((s, i) => (
            <ShareItem key={`hb-${i}`} share={s} color="var(--gold)" sources={result.sources} defaultOpen={professional} />
          ))}
          {awarded.map((s, i) => (
            <ShareItem key={i} share={s} color={colorFor(i)} sources={result.sources} defaultOpen={professional} />
          ))}
        </div>
      </div>

      {result.blocked.length > 0 && (
        <div>
          <div className="res-section-title"><span className="ico" style={{ color: "var(--blocked)" }}><Icon name="ban" size={16} /></span>{t("blocked_title")}</div>
          <div className="blocked-list">
            {result.blocked.map((b, i) => (
              <div className="blocked-item" key={i}>
                <span className="b-name">{b.label}{b.count > 1 ? ` ×${b.count}` : ""}</span>
                <span className="b-why">{b.reason} <Citation id={b.source_id} sources={result.sources} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {professional && (
        <div>
          <div className="res-section-title"><span className="ico"><Icon name="layers" size={16} /></span>{t("steps_title")}</div>
          <div className="timeline">
            {result.steps.map((st, i) => (
              <div className="tl-item" key={i}>
                <div className="tl-rail">
                  <div className="tl-dot">{i + 1}</div>
                  {i < result.steps.length - 1 && <div className="tl-line" />}
                </div>
                <div className="tl-body">
                  <div className="tl-title">{st.title} {st.source_id && <Citation id={st.source_id} sources={result.sources} />}</div>
                  {st.detail && <div className="tl-detail">{st.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.notes.length > 0 && (
        <div>
          <div className="res-section-title"><span className="ico"><Icon name="info" size={16} /></span>{t("notes_title")}</div>
          <div className="note-stack">
            {result.notes.map((n, i) => (
              <div className="callout callout-info" key={i}>
                <span className="c-ico"><Icon name="info" size={16} /></span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="callout callout-warn">
        <span className="c-ico"><Icon name="alert" size={17} /></span>
        <span>{result.disclaimer}</span>
      </div>
    </div>
  );
}
