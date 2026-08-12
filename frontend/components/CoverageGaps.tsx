"use client";

// What this tool does NOT do, said before the user has to find out.
//
// The engine's refusal to guess protects against one failure: a heir configuration whose
// shape it cannot resolve. It cannot protect against the other — a configuration whose
// shape is fine while an entire doctrine is missing. A family with an adopted child
// enters heirs the form accepts and receives a clean, fully cited, complete-looking
// result with no indication that KHI Pasal 209 applies to them and was never implemented.
// Nothing raised, because nothing was malformed.
//
// So the gaps are split by how discoverable they are, not listed as one flat block:
// "silent" gaps get a standing statement in every result, because using the app can never
// reveal them; "raises" and "uncapturable" gaps announce themselves at calculation time
// and sit behind a disclosure for completeness.

import { useState } from "react";
import { CoverageGap } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui";

function GapItem({ gap }: { gap: CoverageGap }) {
  return (
    <li className="gap-item">
      <div className="gap-head">
        <span className="gap-title">{gap.title}</span>
        <span className="badge badge-soft">{gap.kind_label}</span>
        <span className="cite" title={gap.source.reference}>
          <Icon name="book" size={11} /> {gap.source.pointer}
        </span>
      </div>
      {gap.detail && <p className="gap-detail">{gap.detail}</p>}
    </li>
  );
}

export default function CoverageGaps({ gaps }: { gaps: CoverageGap[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (gaps.length === 0) return null;

  const silent = gaps.filter((g) => g.kind === "silent");
  const announced = gaps.filter((g) => g.kind !== "silent");

  return (
    <div className="coverage">
      <div className="res-section-title">
        <span className="ico"><Icon name="info" size={16} /></span>
        {t("coverage_title")}
      </div>

      {/* The dangerous ones. Not collapsible: a gap you cannot discover by using the app
          is the one that must not require a click. */}
      {silent.length > 0 && (
        <div className="coverage-silent">
          <p className="coverage-lede">{t("coverage_silent_lede")}</p>
          <ul className="gap-list">
            {silent.map((g) => <GapItem key={g.key} gap={g} />)}
          </ul>
        </div>
      )}

      {announced.length > 0 && (
        <>
          <button
            className="coverage-toggle"
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name="chevron" size={14} className={open ? "rot" : undefined} />
            {t("coverage_announced_toggle").replace("{n}", String(announced.length))}
          </button>
          {open && (
            <>
              <p className="coverage-lede">{t("coverage_announced_lede")}</p>
              <ul className="gap-list">
                {announced.map((g) => <GapItem key={g.key} gap={g} />)}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
