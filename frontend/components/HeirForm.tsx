"use client";

import { useState } from "react";
import { EstateInput, HeirsInput, Representative, Ruleset } from "@/lib/api";
import { useI18n, relationLabel } from "@/lib/i18n";
import { chipsForSection, summarizeChips, type SectionKey } from "@/lib/summary";
import { Icon, MoneyInput, NumberStepper, HeirSection, SwitchRow } from "./ui";

// PRD §5.1 heir capture. Counts only (names not needed). Representatives (ahli waris
// pengganti) and harta bersama are KHI-only and hidden for other rule sets.
//
// Sections collapse so the whole form is scannable in one screen. Previously all ~29
// controls were always visible, which pushed the Calculate button — and on mobile the
// entire result — below the fold.

interface Props {
  heirs: HeirsInput;
  setHeirs: (h: HeirsInput) => void;
  estate: EstateInput;
  setEstate: (e: EstateInput) => void;
  ruleset: Ruleset;
  hartaBersama: boolean;
  setHartaBersama: (v: boolean) => void;
}

const HEIR_SECTIONS: SectionKey[] = [
  "spouse", "children", "parents", "grandparents", "grandchildren", "siblings",
];

export default function HeirForm({ heirs, setHeirs, estate, setEstate, ruleset, hartaBersama, setHartaBersama }: Props) {
  const { lang, t } = useI18n();
  const L = (id: string) => relationLabel(id, lang);
  const set = (patch: Partial<HeirsInput>) => setHeirs({ ...heirs, ...patch });
  const isKhi = ruleset === "khi";
  const reps = heirs.representatives ?? [];

  const repHeads = reps.reduce((n, r) => n + (r.sons || 0) + (r.daughters || 0), 0);
  const estateEntered = Object.values(estate).filter(Boolean).length;

  // A money field holds a non-zero amount. "0" is treated as unset: it deducts nothing and
  // divides nothing, so warning about it would be noise.
  const isSet = (v?: string) => !!v && /[1-9]/.test(v);
  const hasGross = isSet(estate.gross_value);
  const hasJointAssets = isSet(estate.joint_assets);

  // Open/closed is DERIVED from the data, with explicit user toggles layered on top —
  // not initialized once. A shared link restores its heirs after this component has
  // already mounted, and an initializer would leave that restored data hidden inside
  // collapsed sections.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const toggle = (key: string) =>
    setOverrides((prev) => ({ ...prev, [key]: !isOpen(key) }));

  const filled = (key: string): boolean => {
    if (key === "estate") return estateEntered > 0;
    if (key === "pengganti") return repHeads > 0;
    return chipsForSection(heirs, key as SectionKey, lang).length > 0;
  };

  const anyHeirs = HEIR_SECTIONS.some((s) => filled(s));

  function isOpen(key: string): boolean {
    const override = overrides[key];
    if (override !== undefined) return override;
    if (filled(key)) return true;
    // Nothing entered yet: spouse and children are where nearly every case starts, so the
    // first interaction needs no expanding.
    return !anyHeirs && (key === "spouse" || key === "children");
  }

  /**
   * Shared section props, spread into <HeirSection>. Deliberately a props helper rather
   * than a wrapper component defined in this scope: a component declared inline gets a new
   * type identity on every render, which remounts its subtree and drops focus out of the
   * stepper you are typing in.
   */
  const sectionProps = (id: SectionKey) => {
    const chips = chipsForSection(heirs, id, lang);
    return {
      summary: summarizeChips(chips),
      count: chips.reduce((n, c) => n + c.count, 0),
      open: isOpen(id),
      onToggle: () => toggle(id),
    };
  };

  return (
    <div className="heir-sections">
      <HeirSection icon="heart" title={t("sec_spouse")} {...sectionProps("spouse")}>
        <div className="heir-grid">
          <SwitchRow label={L("suami")} checked={!!heirs.husband} onChange={(v) => set({ husband: v, wives: v ? 0 : heirs.wives })} />
          <NumberStepper label={`${L("istri")} (0–4)`} value={heirs.wives ?? 0} max={4}
            onChange={(n) => set({ wives: n, husband: n > 0 ? false : heirs.husband })} />
        </div>
      </HeirSection>

      <HeirSection icon="baby" title={t("sec_children")} {...sectionProps("children")}>
        <div className="heir-grid">
          <NumberStepper label={L("anak_laki")} value={heirs.sons ?? 0} onChange={(n) => set({ sons: n })} />
          <NumberStepper label={L("anak_perempuan")} value={heirs.daughters ?? 0} onChange={(n) => set({ daughters: n })} />
        </div>
      </HeirSection>

      <HeirSection icon="users" title={t("sec_parents")} {...sectionProps("parents")}>
        <div className="heir-grid">
          <SwitchRow label={L("ayah")} checked={!!heirs.father} onChange={(v) => set({ father: v })} />
          <SwitchRow label={L("ibu")} checked={!!heirs.mother} onChange={(v) => set({ mother: v })} />
        </div>
      </HeirSection>

      <HeirSection icon="crown" title={t("sec_grandparents")} {...sectionProps("grandparents")}>
        <div className="heir-grid one">
          <SwitchRow label={L("kakek")} checked={!!heirs.paternal_grandfather} onChange={(v) => set({ paternal_grandfather: v })} />
        </div>
        <div className="heir-grid mt-8">
          <SwitchRow label={L("nenek_ayah")} checked={!!heirs.paternal_grandmother} onChange={(v) => set({ paternal_grandmother: v })} />
          <SwitchRow label={L("nenek_ibu")} checked={!!heirs.maternal_grandmother} onChange={(v) => set({ maternal_grandmother: v })} />
        </div>
      </HeirSection>

      <HeirSection icon="baby" title={t("sec_grandchildren")} {...sectionProps("grandchildren")}>
        <div className="heir-grid">
          <NumberStepper label={L("cucu_laki")} value={heirs.grandsons_via_son ?? 0} onChange={(n) => set({ grandsons_via_son: n })} />
          <NumberStepper label={L("cucu_perempuan")} value={heirs.granddaughters_via_son ?? 0} onChange={(n) => set({ granddaughters_via_son: n })} />
        </div>
      </HeirSection>

      <HeirSection icon="users" title={t("sec_siblings")} {...sectionProps("siblings")}>
        <div className="heir-grid">
          <NumberStepper label={L("saudara_laki_kandung")} value={heirs.full_brothers ?? 0} onChange={(n) => set({ full_brothers: n })} />
          <NumberStepper label={L("saudari_kandung")} value={heirs.full_sisters ?? 0} onChange={(n) => set({ full_sisters: n })} />
          <NumberStepper label={L("saudara_laki_seayah")} value={heirs.paternal_brothers ?? 0} onChange={(n) => set({ paternal_brothers: n })} />
          <NumberStepper label={L("saudari_seayah")} value={heirs.paternal_sisters ?? 0} onChange={(n) => set({ paternal_sisters: n })} />
        </div>
        <div className="heir-grid one mt-8">
          <NumberStepper label={L("saudara_seibu")} value={heirs.maternal_siblings ?? 0} onChange={(n) => set({ maternal_siblings: n })} />
        </div>
      </HeirSection>

      {isKhi && (
        <HeirSection
          icon="branch"
          title={t("sec_pengganti")}
          summary={repHeads > 0 ? `${reps.length}×` : ""}
          count={repHeads}
          open={isOpen("pengganti")}
          onToggle={() => toggle("pengganti")}
        >
          <p className="small muted" style={{ marginBottom: 10 }}>{t("pengganti_hint")}</p>
          {reps.map((rep, i) => (
            <div key={i} className="card card-pad" style={{ marginBottom: 10, background: "var(--surface-2)" }}>
              <div className="field" style={{ marginBottom: 10 }}>
                <span className="field-label">{t("replacing")}</span>
                <select
                  value={rep.replacing}
                  onChange={(e) => {
                    const next = reps.slice();
                    next[i] = { ...next[i], replacing: e.target.value as "son" | "daughter" };
                    set({ representatives: next });
                  }}
                >
                  <option value="son">{t("predeceased_son")}</option>
                  <option value="daughter">{t("predeceased_daughter")}</option>
                </select>
              </div>
              <div className="heir-grid">
                <NumberStepper label={L("cucu_laki")} value={rep.sons} onChange={(n) => {
                  const next = reps.slice(); next[i] = { ...next[i], sons: n }; set({ representatives: next });
                }} />
                <NumberStepper label={L("cucu_perempuan")} value={rep.daughters} onChange={(n) => {
                  const next = reps.slice(); next[i] = { ...next[i], daughters: n }; set({ representatives: next });
                }} />
              </div>
              <button className="btn btn-ghost" type="button" style={{ marginTop: 10 }}
                onClick={() => set({ representatives: reps.filter((_, j) => j !== i) })}>
                <Icon name="minus" size={15} /> {t("remove")}
              </button>
            </div>
          ))}
          <button className="btn btn-secondary" type="button"
            onClick={() => set({ representatives: [...reps, { replacing: "son", sons: 1, daughters: 0 } as Representative] })}>
            <Icon name="plus" size={16} /> {t("add_pengganti")}
          </button>
        </HeirSection>
      )}

      <HeirSection
        icon="scroll"
        title={t("sec_estate")}
        summary=""
        count={estateEntered}
        open={isOpen("estate")}
        onToggle={() => toggle("estate")}
      >
        <p className="form-note">{t("estate_section_note")}</p>
        <div className="heir-grid">
          <MoneyInput label={t("gross_value")} hint={t("hint_gross")} value={estate.gross_value ?? ""}
            onChange={(v) => setEstate({ ...estate, gross_value: v })} />
          <MoneyInput label={t("funeral_costs")} hint={t("hint_funeral")} value={estate.funeral_costs ?? ""}
            onChange={(v) => setEstate({ ...estate, funeral_costs: v })} />
          <MoneyInput label={t("debts")} hint={t("hint_debts")} value={estate.debts ?? ""}
            onChange={(v) => setEstate({ ...estate, debts: v })} />
          <MoneyInput label={t("wasiyya")} hint={t("hint_wasiyya")} value={estate.wasiyya ?? ""}
            onChange={(v) => setEstate({ ...estate, wasiyya: v })} />
        </div>

        {isKhi && (
          <div className="mt-16 stack gap-10">
            <MoneyInput label={t("joint_assets")} hint={t("hint_joint_assets")}
              value={estate.joint_assets ?? ""}
              onChange={(v) => setEstate({ ...estate, joint_assets: v })} />

            {/* Both ways this field silently does nothing, caught before the user
                calculates and wonders where the rupiah went. */}
            {hasJointAssets && !hasGross && (
              <p className="form-warn"><Icon name="alert" size={14} /> {t("warn_joint_without_gross")}</p>
            )}
            {hasJointAssets && !hartaBersama && (
              <p className="form-warn"><Icon name="alert" size={14} /> {t("warn_joint_not_applied")}</p>
            )}

            <label className="check-line">
              <input type="checkbox" checked={hartaBersama} onChange={(e) => setHartaBersama(e.target.checked)} />
              {t("harta_bersama_toggle")}
            </label>
          </div>
        )}
      </HeirSection>
    </div>
  );
}
