"use client";

import { useState } from "react";
import { CalculationResult, Share, SourceCitation } from "@/lib/api";
import { relationLabel, CATEGORY_LABELS } from "@/lib/labels";

// Renders the full derivation. Personal mode: collapsed "why?" expanders. Professional
// mode: derivation steps expanded by default (PRD §3). Citations render as footnotes.

function Citation({ id, sources }: { id: string; sources: Record<string, SourceCitation> }) {
  const src = sources[id];
  if (!src) return null;
  return (
    <span className="footnote-sup" title={`${src.reference}${src.note ? " — " + src.note : ""}`}>
      [{src.pointer}]
    </span>
  );
}

function ShareRow({
  share,
  sources,
  defaultOpen,
}: {
  share: Share;
  sources: Record<string, SourceCitation>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const pillClass =
    share.category === "furud" ? "pill pill-furud" : share.category === "asabah" ? "pill pill-asabah" : share.category === "radd" ? "pill pill-radd" : "pill";
  return (
    <>
      <tr>
        <td>
          {relationLabel(share.label_id)}
          {share.count > 1 ? ` ×${share.count}` : ""}
        </td>
        <td className="share-frac">
          {share.category === "harta_bersama" ? "—" : share.share.text}
        </td>
        <td>{share.count > 1 && share.category !== "harta_bersama" ? share.per_head.text : "—"}</td>
        <td><span className={pillClass}>{CATEGORY_LABELS[share.category] ?? share.category}</span></td>
        <td>{share.amount ?? "—"}</td>
        <td>
          <button className="why-toggle" onClick={() => setOpen((o) => !o)}>
            {open ? "sembunyikan" : "kenapa?"}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6}>
            <p className="why-body">
              {share.reason} <Citation id={share.source_id} sources={sources} />
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ResultView({ result }: { result: CalculationResult }) {
  const professional = result.mode === "professional";
  const e = result.estate;

  return (
    <div>
      {result.beta && (
        <div className="disclaimer" style={{ marginBottom: 16 }}>
          <span className="badge badge-beta">BETA</span> Rule set ini masih dalam validasi
          ilmiah dan belum boleh dijadikan dasar pembagian final.
        </div>
      )}

      {e && (e.net_divisible !== e.gross_value || Number(e.harta_bersama_deducted) > 0) && (
        <div className="card" style={{ marginTop: 0 }}>
          <h3>Harta yang dibagi</h3>
          <p className="small">
            Kotor {e.gross_value} − pemakaman {e.funeral_costs} − utang {e.debts} − wasiat{" "}
            {e.wasiyya}
            {Number(e.harta_bersama_deducted) > 0 ? ` − harta bersama ${e.harta_bersama_deducted}` : ""} ={" "}
            <strong>{e.net_divisible}</strong>
          </p>
        </div>
      )}

      <h3>
        Pembagian{" "}
        <span className="muted small">
          (pokok masalah {result.pokok_masalah}
          {result.aul_applied ? `, 'aul → ${result.aul_base}` : ""}
          {result.radd_applied ? ", radd" : ""})
        </span>
      </h3>
      <table>
        <thead>
          <tr>
            <th>Ahli waris</th>
            <th>Bagian</th>
            <th>Per orang</th>
            <th>Dasar</th>
            <th>Jumlah</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {result.shares.map((s, i) => (
            <ShareRow key={i} share={s} sources={result.sources} defaultOpen={professional} />
          ))}
        </tbody>
      </table>

      {result.blocked.length > 0 && (
        <>
          <h3>Terhalang (hajb)</h3>
          <table>
            <tbody>
              {result.blocked.map((b, i) => (
                <tr className="blocked-row" key={i}>
                  <td>{relationLabel(b.label_id)}{b.count > 1 ? ` ×${b.count}` : ""}</td>
                  <td colSpan={5}>
                    Terhalang oleh {relationLabel(b.blocked_by_label)} — {b.reason}{" "}
                    <Citation id={b.source_id} sources={result.sources} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {professional && (
        <>
          <h3>Langkah penurunan</h3>
          <ol>
            {result.steps.map((st, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <strong>{st.title}.</strong> {st.detail}{" "}
                {st.source_id && <Citation id={st.source_id} sources={result.sources} />}
              </li>
            ))}
          </ol>
        </>
      )}

      {result.notes.length > 0 && (
        <>
          <h3>Catatan</h3>
          {result.notes.map((n, i) => (
            <div className="note-item" key={i}>{n}</div>
          ))}
        </>
      )}

      <div className="disclaimer" style={{ marginTop: 20 }}>{result.disclaimer}</div>
    </div>
  );
}
