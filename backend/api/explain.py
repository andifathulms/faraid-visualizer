"""Localized derivation prose, generated from the engine's STRUCTURED fields.

Single server-side source of truth for English derivation text (mirrors the interactive
frontend's lib/explain.ts). Indonesian uses the engine's own authoritative prose; English
is regenerated here from ``rule_applied`` / category / asabah_type / relation / share, so
the validated engine needs no changes. Reused by the JSON serializer and the PDF export.
"""

from __future__ import annotations

from fractions import Fraction

from faraid_engine.results import HajbEntry, HeirShare
from .labels import relation_label


def _frac(f: Fraction) -> str:
    return f"{f.numerator}/{f.denominator}" if f.denominator != 1 else str(f.numerator)


def reason_for(share: HeirShare, lang: str) -> str:
    if lang != "en":
        return share.reason

    r = relation_label(share.relation.label_id, "en")
    f = _frac(share.share)
    parts = share.rule_applied.split("|")
    base = parts[0]
    mods = parts[1:]

    if base.startswith("furud:husband") or base.startswith("furud:wife"):
        text = f"{r} receives a fixed share of {f}" + (", divided equally." if share.count > 1 else ".")
    elif "gharrawain" in base:
        text = f"{r} takes 1/3 of the remainder after the spouse (the umariyyah/gharrawain case) = {f}."
    elif base.startswith("furud:mother"):
        text = f"{r} receives a fixed share of {f}."
    elif base.startswith("furud+asabah"):
        text = f"{r}: 1/6 fixed share plus the residue as asabah = {f}."
    elif base.startswith("furud:father") or base.startswith("furud:grandfather"):
        text = f"{r} receives 1/6 as a fixed share."
    elif base.startswith("furud:granddaughter") and f == "1/6":
        text = f"{r} takes 1/6 to complete 2/3 alongside a single daughter."
    elif base.startswith("furud:paternal_sister") and f == "1/6":
        text = f"{r} takes 1/6 to complete 2/3 alongside a full sister."
    elif base.startswith("furud"):
        text = f"{r} takes a fixed Qur'anic share of {f}" + (", shared equally." if share.count > 1 else ".")
    elif base.startswith("asabah:bi_ghairihi"):
        text = f"{r} becomes residuary (2:1) alongside the male of the same class — {f}."
    elif base.startswith("asabah:maa_ghairihi"):
        text = f"{r} becomes residuary together with a female descendant — {f}."
    elif base.startswith("asabah"):
        text = f"{r} takes the residue as asabah — {f}."
    elif base.startswith("jadd_muqasama"):
        text = f"{r} shares the residue with the grandfather via Zaid's muqasama — {f}."
    elif base.startswith("representation"):
        text = f"{r} inherits as a substitute heir (KHI Art. 185), taking the predeceased parent's share — {f}."
    elif share.category.value == "harta_bersama":
        text = f"{r}'s joint-property share, separated before faraid applies."
    else:
        text = f"{r}: {f}."

    if "radd" in base or any("radd" in m for m in mods):
        text += f" Increased by radd (return of surplus) to {f}."
    aul = next((m for m in mods if m.startswith("aul:")), None)
    if aul:
        text += f" Reduced proportionally by 'aul ({aul.replace('aul:', '')})."
    return text


def blocked_reason(b: HajbEntry, lang: str) -> str:
    if lang != "en":
        return b.reason
    who = relation_label(b.relation.label_id, "en")
    by = relation_label(b.blocked_by.label_id, "en")
    return f"{who} is blocked by {by} and does not inherit in this configuration."


def translate_note(note: str, lang: str) -> str:
    if lang != "en":
        return note
    if "Pasal 177" in note:
        return (
            "KHI Art. 177 note: the literal text gives the father 1/3 when there is no child, "
            "but Supreme Court jurisprudence and mainstream practice read the father as 1/6 with "
            "a descendant and residuary otherwise — applied here."
        )
    if "Pasal 185" in note:
        return (
            "Substitute heirs applied (KHI Art. 185) — this concept does not exist in classical "
            "Syafi'i fiqh; there the grandchildren are usually blocked or fall under distant kindred."
        )
    if note.startswith("BETA"):
        return (
            "BETA — this rule set is still under scholarly validation and must not be used as the "
            "basis for a final division (PRD §4)."
        )
    if "baitul mal" in note.lower():
        return "The remaining share is not distributed to the heirs and classically escheats to the baitul mal."
    return note
