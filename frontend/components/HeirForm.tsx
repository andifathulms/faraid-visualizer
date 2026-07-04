"use client";

import { EstateInput, HeirsInput, Representative, Ruleset } from "@/lib/api";
import { useI18n, relationLabel } from "@/lib/i18n";
import { Icon, NumberStepper, SwitchRow } from "./ui";

// PRD §5.1 heir capture. Counts only (names not needed). Representatives (ahli waris
// pengganti) and harta bersama are KHI-only and hidden for other rule sets.

interface Props {
  heirs: HeirsInput;
  setHeirs: (h: HeirsInput) => void;
  estate: EstateInput;
  setEstate: (e: EstateInput) => void;
  ruleset: Ruleset;
  hartaBersama: boolean;
  setHartaBersama: (v: boolean) => void;
}

function SectionLabel({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="section-label">
      <span className="ico"><Icon name={icon} size={15} /></span>
      {children}
    </div>
  );
}

export default function HeirForm({ heirs, setHeirs, estate, setEstate, ruleset, hartaBersama, setHartaBersama }: Props) {
  const { lang, t } = useI18n();
  const L = (id: string) => relationLabel(id, lang);
  const set = (patch: Partial<HeirsInput>) => setHeirs({ ...heirs, ...patch });
  const isKhi = ruleset === "khi";
  const reps = heirs.representatives ?? [];

  const setRep = (i: number, patch: Partial<Representative>) => {
    const next = reps.slice();
    next[i] = { ...next[i], ...patch };
    set({ representatives: next });
  };
  const addRep = () => set({ representatives: [...reps, { replacing: "son", sons: 1, daughters: 0 }] });
  const removeRep = (i: number) => set({ representatives: reps.filter((_, j) => j !== i) });

  return (
    <div>
      <SectionLabel icon="heart">{t("sec_spouse")}</SectionLabel>
      <div className="heir-grid">
        <SwitchRow label={L("suami")} checked={!!heirs.husband} onChange={(v) => set({ husband: v, wives: v ? 0 : heirs.wives })} />
        <NumberStepper label={`${L("istri")} (0–4)`} value={heirs.wives ?? 0} max={4}
          onChange={(n) => set({ wives: n, husband: n > 0 ? false : heirs.husband })} />
      </div>

      <SectionLabel icon="baby">{t("sec_children")}</SectionLabel>
      <div className="heir-grid">
        <NumberStepper label={L("anak_laki")} value={heirs.sons ?? 0} onChange={(n) => set({ sons: n })} />
        <NumberStepper label={L("anak_perempuan")} value={heirs.daughters ?? 0} onChange={(n) => set({ daughters: n })} />
      </div>

      <SectionLabel icon="users">{t("sec_parents")}</SectionLabel>
      <div className="heir-grid">
        <SwitchRow label={L("ayah")} checked={!!heirs.father} onChange={(v) => set({ father: v })} />
        <SwitchRow label={L("ibu")} checked={!!heirs.mother} onChange={(v) => set({ mother: v })} />
      </div>

      <SectionLabel icon="crown">{t("sec_grandparents")}</SectionLabel>
      <div className="heir-grid one">
        <SwitchRow label={L("kakek")} checked={!!heirs.paternal_grandfather} onChange={(v) => set({ paternal_grandfather: v })} />
      </div>
      <div className="heir-grid mt-8">
        <SwitchRow label={L("nenek_ayah")} checked={!!heirs.paternal_grandmother} onChange={(v) => set({ paternal_grandmother: v })} />
        <SwitchRow label={L("nenek_ibu")} checked={!!heirs.maternal_grandmother} onChange={(v) => set({ maternal_grandmother: v })} />
      </div>

      <SectionLabel icon="baby">{t("sec_grandchildren")}</SectionLabel>
      <div className="heir-grid">
        <NumberStepper label={L("cucu_laki")} value={heirs.grandsons_via_son ?? 0} onChange={(n) => set({ grandsons_via_son: n })} />
        <NumberStepper label={L("cucu_perempuan")} value={heirs.granddaughters_via_son ?? 0} onChange={(n) => set({ granddaughters_via_son: n })} />
      </div>

      <SectionLabel icon="users">{t("sec_siblings")}</SectionLabel>
      <div className="heir-grid">
        <NumberStepper label={L("saudara_laki_kandung")} value={heirs.full_brothers ?? 0} onChange={(n) => set({ full_brothers: n })} />
        <NumberStepper label={L("saudari_kandung")} value={heirs.full_sisters ?? 0} onChange={(n) => set({ full_sisters: n })} />
        <NumberStepper label={L("saudara_laki_seayah")} value={heirs.paternal_brothers ?? 0} onChange={(n) => set({ paternal_brothers: n })} />
        <NumberStepper label={L("saudari_seayah")} value={heirs.paternal_sisters ?? 0} onChange={(n) => set({ paternal_sisters: n })} />
      </div>
      <div className="heir-grid one mt-8">
        <NumberStepper label={L("saudara_seibu")} value={heirs.maternal_siblings ?? 0} onChange={(n) => set({ maternal_siblings: n })} />
      </div>

      {isKhi && (
        <>
          <SectionLabel icon="branch">{t("sec_pengganti")}</SectionLabel>
          <p className="small muted" style={{ marginTop: -2, marginBottom: 10 }}>{t("pengganti_hint")}</p>
          {reps.map((rep, i) => (
            <div key={i} className="card card-pad" style={{ marginBottom: 10, background: "var(--surface-2)" }}>
              <div className="field" style={{ marginBottom: 10 }}>
                <span className="field-label">{t("replacing")}</span>
                <select value={rep.replacing} onChange={(e) => setRep(i, { replacing: e.target.value as "son" | "daughter" })}>
                  <option value="son">{t("predeceased_son")}</option>
                  <option value="daughter">{t("predeceased_daughter")}</option>
                </select>
              </div>
              <div className="heir-grid">
                <NumberStepper label={L("cucu_laki")} value={rep.sons} onChange={(n) => setRep(i, { sons: n })} />
                <NumberStepper label={L("cucu_perempuan")} value={rep.daughters} onChange={(n) => setRep(i, { daughters: n })} />
              </div>
              <button className="btn btn-ghost" type="button" style={{ marginTop: 10 }} onClick={() => removeRep(i)}>
                <Icon name="minus" size={15} /> {t("remove")}
              </button>
            </div>
          ))}
          <button className="btn btn-secondary" type="button" onClick={addRep}>
            <Icon name="plus" size={16} /> {t("add_pengganti")}
          </button>
        </>
      )}

      <SectionLabel icon="scroll">{t("sec_estate")}</SectionLabel>
      <div className="heir-grid">
        <div className="field"><span className="field-label">{t("gross_value")}</span>
          <input type="number" min={0} value={estate.gross_value ?? ""} placeholder="0" onChange={(e) => setEstate({ ...estate, gross_value: e.target.value })} /></div>
        <div className="field"><span className="field-label">{t("funeral_costs")}</span>
          <input type="number" min={0} value={estate.funeral_costs ?? ""} placeholder="0" onChange={(e) => setEstate({ ...estate, funeral_costs: e.target.value })} /></div>
        <div className="field"><span className="field-label">{t("debts")}</span>
          <input type="number" min={0} value={estate.debts ?? ""} placeholder="0" onChange={(e) => setEstate({ ...estate, debts: e.target.value })} /></div>
        <div className="field"><span className="field-label">{t("wasiyya")}</span>
          <input type="number" min={0} value={estate.wasiyya ?? ""} placeholder="0" onChange={(e) => setEstate({ ...estate, wasiyya: e.target.value })} /></div>
      </div>

      {isKhi && (
        <div className="mt-16 stack gap-10">
          <div className="field"><span className="field-label">{t("joint_assets")}</span>
            <input type="number" min={0} value={estate.joint_assets ?? ""} placeholder="0" onChange={(e) => setEstate({ ...estate, joint_assets: e.target.value })} /></div>
          <label className="check-line">
            <input type="checkbox" checked={hartaBersama} onChange={(e) => setHartaBersama(e.target.checked)} />
            {t("harta_bersama_toggle")}
          </label>
        </div>
      )}
    </div>
  );
}
