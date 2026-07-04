"use client";

import { EstateInput, HeirsInput, Representative, Ruleset } from "@/lib/api";

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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        min={0}
        value={value ?? 0}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || "0", 10)))}
      />
    </div>
  );
}

function BoolField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export default function HeirForm({
  heirs,
  setHeirs,
  estate,
  setEstate,
  ruleset,
  hartaBersama,
  setHartaBersama,
}: Props) {
  const set = (patch: Partial<HeirsInput>) => setHeirs({ ...heirs, ...patch });
  const isKhi = ruleset === "khi";
  const reps = heirs.representatives ?? [];

  const setRep = (i: number, patch: Partial<Representative>) => {
    const next = reps.slice();
    next[i] = { ...next[i], ...patch };
    set({ representatives: next });
  };
  const addRep = () =>
    set({ representatives: [...reps, { replacing: "son", sons: 1, daughters: 0 }] });
  const removeRep = (i: number) =>
    set({ representatives: reps.filter((_, j) => j !== i) });

  return (
    <div>
      <h3>Pasangan</h3>
      <div className="row">
        <BoolField label="Suami" value={heirs.husband} onChange={(v) => set({ husband: v, wives: v ? 0 : heirs.wives })} />
        <NumberField label="Jumlah istri (0–4)" value={heirs.wives} onChange={(n) => set({ wives: Math.min(4, n), husband: n > 0 ? false : heirs.husband })} />
      </div>

      <h3>Anak</h3>
      <div className="row">
        <NumberField label="Anak laki-laki" value={heirs.sons} onChange={(n) => set({ sons: n })} />
        <NumberField label="Anak perempuan" value={heirs.daughters} onChange={(n) => set({ daughters: n })} />
      </div>

      <h3>Orang tua</h3>
      <div className="row">
        <BoolField label="Ayah" value={heirs.father} onChange={(v) => set({ father: v })} />
        <BoolField label="Ibu" value={heirs.mother} onChange={(v) => set({ mother: v })} />
      </div>

      <h3>Kakek & Nenek</h3>
      <div className="row">
        <BoolField label="Kakek (dari ayah)" value={heirs.paternal_grandfather} onChange={(v) => set({ paternal_grandfather: v })} />
        <BoolField label="Nenek (dari ayah)" value={heirs.paternal_grandmother} onChange={(v) => set({ paternal_grandmother: v })} />
        <BoolField label="Nenek (dari ibu)" value={heirs.maternal_grandmother} onChange={(v) => set({ maternal_grandmother: v })} />
      </div>

      <h3>Cucu (dari anak laki-laki)</h3>
      <div className="row">
        <NumberField label="Cucu laki-laki" value={heirs.grandsons_via_son} onChange={(n) => set({ grandsons_via_son: n })} />
        <NumberField label="Cucu perempuan" value={heirs.granddaughters_via_son} onChange={(n) => set({ granddaughters_via_son: n })} />
      </div>

      <h3>Saudara</h3>
      <div className="row">
        <NumberField label="Saudara laki kandung" value={heirs.full_brothers} onChange={(n) => set({ full_brothers: n })} />
        <NumberField label="Saudari kandung" value={heirs.full_sisters} onChange={(n) => set({ full_sisters: n })} />
        <NumberField label="Saudara laki seayah" value={heirs.paternal_brothers} onChange={(n) => set({ paternal_brothers: n })} />
        <NumberField label="Saudari seayah" value={heirs.paternal_sisters} onChange={(n) => set({ paternal_sisters: n })} />
        <NumberField label="Saudara/i seibu" value={heirs.maternal_siblings} onChange={(n) => set({ maternal_siblings: n })} />
      </div>

      {isKhi && (
        <>
          <h3>Ahli waris pengganti (KHI Pasal 185)</h3>
          <p className="small muted">
            Untuk anak yang telah wafat lebih dulu; keturunannya menggantikan bagiannya.
            Konsep ini tidak ada dalam fiqh Syafi&apos;i klasik.
          </p>
          {reps.map((rep, i) => (
            <div className="row" key={i} style={{ alignItems: "flex-end", marginBottom: 8 }}>
              <div className="field">
                <label>Menggantikan</label>
                <select value={rep.replacing} onChange={(e) => setRep(i, { replacing: e.target.value as "son" | "daughter" })}>
                  <option value="son">Anak laki-laki (wafat)</option>
                  <option value="daughter">Anak perempuan (wafat)</option>
                </select>
              </div>
              <NumberField label="Cucu laki" value={rep.sons} onChange={(n) => setRep(i, { sons: n })} />
              <NumberField label="Cucu perempuan" value={rep.daughters} onChange={(n) => setRep(i, { daughters: n })} />
              <button className="btn btn-secondary" type="button" onClick={() => removeRep(i)}>
                Hapus
              </button>
            </div>
          ))}
          <button className="btn btn-secondary" type="button" onClick={addRep}>
            + Tambah ahli waris pengganti
          </button>
        </>
      )}

      <h3>Harta peninggalan (opsional)</h3>
      <div className="row">
        <div className="field">
          <label>Nilai kotor</label>
          <input type="number" min={0} value={estate.gross_value ?? ""} placeholder="mis. 1000000"
            onChange={(e) => setEstate({ ...estate, gross_value: e.target.value })} />
        </div>
        <div className="field">
          <label>Biaya pemakaman</label>
          <input type="number" min={0} value={estate.funeral_costs ?? ""} onChange={(e) => setEstate({ ...estate, funeral_costs: e.target.value })} />
        </div>
        <div className="field">
          <label>Utang</label>
          <input type="number" min={0} value={estate.debts ?? ""} onChange={(e) => setEstate({ ...estate, debts: e.target.value })} />
        </div>
        <div className="field">
          <label>Wasiat (maks 1/3)</label>
          <input type="number" min={0} value={estate.wasiyya ?? ""} onChange={(e) => setEstate({ ...estate, wasiyya: e.target.value })} />
        </div>
      </div>

      {isKhi && (
        <div className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Total harta bersama</label>
            <input type="number" min={0} value={estate.joint_assets ?? ""} onChange={(e) => setEstate({ ...estate, joint_assets: e.target.value })} />
          </div>
          <label className="checkbox" style={{ alignSelf: "flex-end", marginBottom: 8 }}>
            <input type="checkbox" checked={hartaBersama} onChange={(e) => setHartaBersama(e.target.checked)} />
            Pisahkan harta bersama (1/2) sebelum faraid
          </label>
        </div>
      )}
    </div>
  );
}
