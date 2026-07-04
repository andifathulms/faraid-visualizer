"use client";

import { EstateInput, HeirsInput, Representative, Ruleset } from "@/lib/api";
import { useI18n, relationLabel } from "@/lib/i18n";

// PRD §5.1 heir capture. Counts only (names not needed for calculation). Representatives
// (ahli waris pengganti) and harta bersama are KHI-only and hidden for other rule sets.

interface Props {
  heirs: HeirsInput;
  setHeirs: (h: HeirsInput) => void;
  estate: EstateInput;
  setEstate: (e: EstateInput) => void;
  ruleset: Ruleset;
  hartaBersama: boolean;
  setHartaBersama: (v: boolean) => void;
}

function NumberField({ label, value, onChange }: { label: string; value: number | undefined; onChange: (n: number) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="number" min={0} value={value ?? 0}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || "0", 10)))} />
    </div>
  );
}

function BoolField({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
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
      <h3>{t("sec_spouse")}</h3>
      <div className="row">
        <BoolField label={L("suami")} value={heirs.husband} onChange={(v) => set({ husband: v, wives: v ? 0 : heirs.wives })} />
        <NumberField label={`${L("istri")} (0–4)`} value={heirs.wives} onChange={(n) => set({ wives: Math.min(4, n), husband: n > 0 ? false : heirs.husband })} />
      </div>

      <h3>{t("sec_children")}</h3>
      <div className="row">
        <NumberField label={L("anak_laki")} value={heirs.sons} onChange={(n) => set({ sons: n })} />
        <NumberField label={L("anak_perempuan")} value={heirs.daughters} onChange={(n) => set({ daughters: n })} />
      </div>

      <h3>{t("sec_parents")}</h3>
      <div className="row">
        <BoolField label={L("ayah")} value={heirs.father} onChange={(v) => set({ father: v })} />
        <BoolField label={L("ibu")} value={heirs.mother} onChange={(v) => set({ mother: v })} />
      </div>

      <h3>{t("sec_grandparents")}</h3>
      <div className="row">
        <BoolField label={L("kakek")} value={heirs.paternal_grandfather} onChange={(v) => set({ paternal_grandfather: v })} />
        <BoolField label={L("nenek_ayah")} value={heirs.paternal_grandmother} onChange={(v) => set({ paternal_grandmother: v })} />
        <BoolField label={L("nenek_ibu")} value={heirs.maternal_grandmother} onChange={(v) => set({ maternal_grandmother: v })} />
      </div>

      <h3>{t("sec_grandchildren")}</h3>
      <div className="row">
        <NumberField label={L("cucu_laki")} value={heirs.grandsons_via_son} onChange={(n) => set({ grandsons_via_son: n })} />
        <NumberField label={L("cucu_perempuan")} value={heirs.granddaughters_via_son} onChange={(n) => set({ granddaughters_via_son: n })} />
      </div>

      <h3>{t("sec_siblings")}</h3>
      <div className="row">
        <NumberField label={L("saudara_laki_kandung")} value={heirs.full_brothers} onChange={(n) => set({ full_brothers: n })} />
        <NumberField label={L("saudari_kandung")} value={heirs.full_sisters} onChange={(n) => set({ full_sisters: n })} />
        <NumberField label={L("saudara_laki_seayah")} value={heirs.paternal_brothers} onChange={(n) => set({ paternal_brothers: n })} />
        <NumberField label={L("saudari_seayah")} value={heirs.paternal_sisters} onChange={(n) => set({ paternal_sisters: n })} />
        <NumberField label={L("saudara_seibu")} value={heirs.maternal_siblings} onChange={(n) => set({ maternal_siblings: n })} />
      </div>

      {isKhi && (
        <>
          <h3>{t("sec_pengganti")}</h3>
          <p className="small muted">{t("pengganti_hint")}</p>
          {reps.map((rep, i) => (
            <div className="row" key={i} style={{ alignItems: "flex-end", marginBottom: 8 }}>
              <div className="field">
                <label>{t("replacing")}</label>
                <select value={rep.replacing} onChange={(e) => setRep(i, { replacing: e.target.value as "son" | "daughter" })}>
                  <option value="son">{t("predeceased_son")}</option>
                  <option value="daughter">{t("predeceased_daughter")}</option>
                </select>
              </div>
              <NumberField label={L("cucu_laki")} value={rep.sons} onChange={(n) => setRep(i, { sons: n })} />
              <NumberField label={L("cucu_perempuan")} value={rep.daughters} onChange={(n) => setRep(i, { daughters: n })} />
              <button className="btn btn-secondary" type="button" onClick={() => removeRep(i)}>{t("remove")}</button>
            </div>
          ))}
          <button className="btn btn-secondary" type="button" onClick={addRep}>{t("add_pengganti")}</button>
        </>
      )}

      <h3>{t("sec_estate")}</h3>
      <div className="row">
        <div className="field">
          <label>{t("gross_value")}</label>
          <input type="number" min={0} value={estate.gross_value ?? ""} onChange={(e) => setEstate({ ...estate, gross_value: e.target.value })} />
        </div>
        <div className="field">
          <label>{t("funeral_costs")}</label>
          <input type="number" min={0} value={estate.funeral_costs ?? ""} onChange={(e) => setEstate({ ...estate, funeral_costs: e.target.value })} />
        </div>
        <div className="field">
          <label>{t("debts")}</label>
          <input type="number" min={0} value={estate.debts ?? ""} onChange={(e) => setEstate({ ...estate, debts: e.target.value })} />
        </div>
        <div className="field">
          <label>{t("wasiyya")}</label>
          <input type="number" min={0} value={estate.wasiyya ?? ""} onChange={(e) => setEstate({ ...estate, wasiyya: e.target.value })} />
        </div>
      </div>

      {isKhi && (
        <div className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>{t("joint_assets")}</label>
            <input type="number" min={0} value={estate.joint_assets ?? ""} onChange={(e) => setEstate({ ...estate, joint_assets: e.target.value })} />
          </div>
          <label className="checkbox" style={{ alignSelf: "flex-end", marginBottom: 8 }}>
            <input type="checkbox" checked={hartaBersama} onChange={(e) => setHartaBersama(e.target.checked)} />
            {t("harta_bersama_toggle")}
          </label>
        </div>
      )}
    </div>
  );
}
