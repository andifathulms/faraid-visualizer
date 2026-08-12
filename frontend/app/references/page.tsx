"use client";

// The citation registry as a place you can go, not only as a tooltip you can trigger.
//
// sources.py was the first engine commit by design: uncited rules don't ship, so the
// citations are the substrate the results stand on. But the only way to encounter one was
// to construct a case that fired its rule and hover the chip — which means a notaris
// deciding whether this tool's output can go near a case file had no way to see what the
// whole thing rests on, or where it stops.
//
// Data is generated from sources.py and coverage.py by
// backend/scripts/export_reference_data.py, with a test that fails when it goes stale. A
// hand-maintained copy of a citation list would be the "we'll keep it in sync" promise
// this project otherwise refuses to make. It is also why this page boots no engine: 35
// rows are not worth a 9 MB WebAssembly runtime.
//
// PRD §5.3: Qur'an and hadith are POINTERS ONLY. No ayat text, no matn — asserted at the
// data layer in faraid_web/tests/test_reference_export.py, and nothing here adds prose of
// its own to a citation.

import { useMemo, useState } from "react";
import Link from "next/link";
import data from "@/lib/generated/reference-data.json";
import { useI18n, rulesetLabel, type Lang } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";
import { Icon, Segmented } from "@/components/ui";
import type { CoverageGap, Ruleset, SourceCitation } from "@/lib/api";

const HOME_HREF = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`;
const BRAND_ICON = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/brand/faraidvisualizer-icon.svg`;

const RULESETS: Ruleset[] = ["khi", "syafii", "hanafi", "maliki", "hanbali"];

/** Registry order, so the page reads from scripture outward to practice. */
const TYPE_ORDER = ["quran", "hadith", "ijma", "khi", "classical", "case_law"] as const;
type SourceType = (typeof TYPE_ORDER)[number];

const SOURCES = data.sources as SourceCitation[];
const GAPS = data.gaps as Record<string, Record<string, CoverageGap[]>>;

export default function References() {
  const { t, lang, setLang } = useI18n();
  const [ruleset, setRuleset] = useState<Ruleset>("khi");

  const grouped = useMemo(() => {
    const by = new Map<string, SourceCitation[]>();
    for (const s of SOURCES) {
      const list = by.get(s.type) ?? [];
      list.push(s);
      by.set(s.type, list);
    }
    return TYPE_ORDER.filter((k) => by.has(k)).map((k) => [k, by.get(k)!] as const);
  }, []);

  const gaps = GAPS[lang]?.[ruleset] ?? [];
  const silent = gaps.filter((g) => g.kind === "silent");
  const announced = gaps.filter((g) => g.kind !== "silent");

  return (
    <>
      <header className="app-bar">
        <div className="app-bar-inner">
          <a className="brand" href={HOME_HREF} title={t("go_home")} aria-label={t("go_home")}>
            <img className="brand-mark" src={BRAND_ICON} width={40} height={40} alt="" />
            <div>
              <div className="brand-name">Faraid<b>Visualizer</b></div>
              <div className="brand-tag">{t("app_tagline")}</div>
            </div>
          </a>
          <div className="row gap-10">
            <ThemeToggle />
            <Segmented<Lang>
              ariaLabel="Language"
              value={lang}
              onChange={setLang}
              options={[
                { value: "id", label: "ID" },
                { value: "en", label: "EN" },
              ]}
            />
          </div>
        </div>
      </header>

      <main className="doc-page">
        <Link className="doc-back" href="/">
          <Icon name="arrow" size={15} className="flip" /> {t("ref_back")}
        </Link>

        <h1 className="doc-title">{t("ref_title")}</h1>
        <p className="doc-lede">{t("ref_lede")}</p>

        <div className="doc-stats">
          <span className="summary-stat"><b>{SOURCES.length}</b> {t("ref_stat_sources")}</span>
          {grouped.map(([type, list]) => (
            <span className="summary-stat" key={type}>
              {t(`ref_type_${type}` as never)} <b>{list.length}</b>
            </span>
          ))}
        </div>

        {grouped.map(([type, list]) => (
          <section className="doc-section" key={type}>
            <h2 className="doc-h2">{t(`ref_type_${type}` as never)}</h2>
            <p className="doc-note">{t(`ref_type_note_${type}` as never)}</p>
            <ul className="ref-list">
              {list.map((s) => (
                <li className="ref-item" key={s.id}>
                  <span className="cite">
                    <Icon name="book" size={11} /> {s.pointer}
                  </span>
                  <div className="ref-body">
                    <div className="ref-ref">{s.reference}</div>
                    {s.note && <p className="ref-note">{s.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* The other half of "what does this rest on": where it stops. */}
        <section className="doc-section">
          <h2 className="doc-h2">{t("coverage_title")}</h2>
          <p className="doc-note">{t("ref_gaps_lede")}</p>

          <div style={{ margin: "var(--sp-3) 0" }}>
            <Segmented<Ruleset>
              ariaLabel={t("legal_basis")}
              value={ruleset}
              onChange={setRuleset}
              options={RULESETS.map((r) => ({ value: r, label: rulesetLabel(r, lang) }))}
            />
          </div>

          {silent.length > 0 && (
            <>
              <p className="coverage-lede">{t("coverage_silent_lede")}</p>
              <ul className="gap-list coverage-silent">
                {silent.map((g) => (
                  <li className="gap-item" key={g.key}>
                    <div className="gap-head">
                      <span className="gap-title">{g.title}</span>
                      <span className="badge badge-soft">{g.kind_label}</span>
                      <span className="cite" title={g.source.reference}>
                        <Icon name="book" size={11} /> {g.source.pointer}
                      </span>
                    </div>
                    <p className="gap-detail">{g.detail}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {announced.length > 0 && (
            <>
              <p className="coverage-lede" style={{ marginTop: "var(--sp-4)" }}>
                {t("coverage_announced_lede")}
              </p>
              <ul className="gap-list">
                {announced.map((g) => (
                  <li className="gap-item" key={g.key}>
                    <div className="gap-head">
                      <span className="gap-title">{g.title}</span>
                      <span className="badge badge-soft">{g.kind_label}</span>
                      <span className="cite" title={g.source.reference}>
                        <Icon name="book" size={11} /> {g.source.pointer}
                      </span>
                    </div>
                    <p className="gap-detail">{g.detail}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <p className="doc-foot">{t("ref_policy")}</p>
      </main>
    </>
  );
}
