// English derivation text generated from the API's STRUCTURED fields (rule_applied,
// category, asabah_type, relation, share). In Indonesian mode the engine's own prose is
// used; English mode regenerates here so the validated engine needs no changes.

import { Blocked, Share, Step } from "./api";
import { Lang, relationLabel } from "./i18n";

function rel(labelId: string): string {
  return relationLabel(labelId, "en");
}

export function explainShare(share: Share, lang: Lang): string {
  if (lang === "id") return share.reason;

  const r = rel(share.label_id);
  const f = share.share.text;
  const base = share.rule_applied.split("|")[0];
  const mods = share.rule_applied.split("|").slice(1);

  let text: string;
  if (base.startsWith("furud:husband") || base.startsWith("furud:wife")) {
    text = `${r} receives a fixed share of ${f}${share.count > 1 ? ", divided equally" : ""}.`;
  } else if (base.includes("gharrawain")) {
    text = `${r} takes 1/3 of the remainder after the spouse (the umariyyah/gharrawain case) = ${f}.`;
  } else if (base.startsWith("furud:mother")) {
    text = `${r} receives a fixed share of ${f}.`;
  } else if (base.startsWith("furud:father") || base.startsWith("furud:grandfather")) {
    text = `${r} receives 1/6 as a fixed share${base.includes("+asabah") ? " plus the residue" : ""}.`;
  } else if (base.startsWith("furud+asabah")) {
    text = `${r}: 1/6 fixed share plus the residue as asabah = ${f}.`;
  } else if (base.startsWith("furud:granddaughter") && f === "1/6") {
    text = `${r} takes 1/6 to complete 2/3 alongside a single daughter.`;
  } else if (base.startsWith("furud:paternal_sister") && f === "1/6") {
    text = `${r} takes 1/6 to complete 2/3 alongside a full sister.`;
  } else if (base.startsWith("furud")) {
    text = `${r} takes a fixed Qur'anic share of ${f}${share.count > 1 ? ", shared equally" : ""}.`;
  } else if (base.startsWith("asabah:bi_ghairihi")) {
    text = `${r} becomes residuary (2:1) alongside the male of the same class — ${f}.`;
  } else if (base.startsWith("asabah:maa_ghairihi")) {
    text = `${r} becomes residuary together with a female descendant — ${f}.`;
  } else if (base.startsWith("asabah")) {
    text = `${r} takes the residue as asabah — ${f}.`;
  } else if (base.startsWith("jadd_muqasama")) {
    text = `${r} shares the residue with the grandfather via Zaid's muqasama — ${f}.`;
  } else if (base.startsWith("representation")) {
    text = `${r} inherits as a substitute heir (KHI Art. 185), taking the predeceased parent's share — ${f}.`;
  } else if (share.category === "harta_bersama") {
    text = `${r}'s joint-property share, separated before faraid applies.`;
  } else {
    text = `${r}: ${f}.`;
  }

  if (mods.includes("radd") || base.includes("radd")) {
    text += ` Increased by radd (return of surplus) to ${f}.`;
  }
  const aul = mods.find((m) => m.startsWith("aul:"));
  if (aul) text += ` Reduced proportionally by 'aul (${aul.replace("aul:", "")}).`;
  return text;
}

export function explainBlocked(b: Blocked, lang: Lang): string {
  if (lang === "id") return b.reason;
  return `${rel(b.label_id)} is blocked by ${rel(b.blocked_by_label)} and does not inherit in this configuration.`;
}

const STEP_TITLE_EN: Record<string, string> = {
  debts: "Settlement of obligations on the estate",
  harta_bersama: "Separation of joint marital property",
  hajb: "Blocking (hajb)",
  furud: "Fixed shares (furud muqaddarah)",
  asabah: "Residuary distribution (asabah)",
  jadd_muqasama: "Grandfather with siblings (muqasama)",
  aul: "'Aul — proportional reduction",
  radd: "Radd — return of surplus",
  representation: "Substitute heirs (KHI Art. 185)",
};

export function stepTitle(step: Step, lang: Lang): string {
  return lang === "id" ? step.title : STEP_TITLE_EN[step.step] ?? step.title;
}

export function stepDetail(step: Step, lang: Lang): string {
  // Detailed derivation prose is authored in Indonesian; in English we show the localized
  // title and keep the numeric detail only when it is language-neutral enough.
  if (lang === "id") return step.detail;
  return "";
}

// Translate the fixed engine notes to English by keyword; fall back to the original.
export function translateNote(note: string, lang: Lang): string {
  if (lang === "id") return note;
  if (note.includes("Pasal 177")) {
    return "KHI Art. 177 note: the literal text gives the father 1/3 when there is no child, but Supreme Court jurisprudence and mainstream practice read the father as 1/6 with a descendant and residuary otherwise — applied here.";
  }
  if (note.includes("Pasal 185")) {
    return "Substitute heirs applied (KHI Art. 185) — this concept does not exist in classical Syafi'i fiqh; there the grandchildren are usually blocked or fall under distant kindred.";
  }
  if (note.startsWith("BETA")) {
    return "BETA — this rule set is still under scholarly validation and must not be used as the basis for a final division (PRD §4).";
  }
  if (note.toLowerCase().includes("baitul mal")) {
    return "The remaining share is not distributed to the heirs and classically escheats to the baitul mal.";
  }
  return note;
}
