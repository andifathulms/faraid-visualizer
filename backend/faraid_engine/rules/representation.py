"""Ahli waris pengganti — KHI Pasal 185 (representation).

KHI ONLY. Classical Syafi'i has no representation concept (PRD §4.1); the input validator
already blocks representatives on non-KHI rulesets.

Method (augmented-heir): a predeceased child is counted as if living for the purpose of
dividing shares; the portion attributable to that one virtual child slot is then handed to
the child's branch (their children), split 2:1 among grandsons:granddaughters. Because the
branch receives exactly one same-degree slot, it never exceeds a living same-degree heir's
share — satisfying the Pasal 185(2) cap.

v1 scope: representatives replacing a predeceased SON or DAUGHTER only. Deeper or mixed
representation (grandchild-of-grandchild, sibling branches) raises UnsupportedConfiguration
rather than guessing (CLAUDE.md).
"""

from __future__ import annotations

from dataclasses import replace
from fractions import Fraction
from math import gcd

from ..exceptions import UnsupportedConfiguration
from ..heirs import Heirs, Relation
from ..results import AsabahType, DerivationStep, ShareCategory
from ..rulesets.base import RuleSetConfig
from .awards import Award
from .derive import DeriveResult, derive

R = Relation
_SUPPORTED = {R.SON, R.DAUGHTER}


def _frac(f: Fraction) -> str:
    return f"{f.numerator}/{f.denominator}" if f.denominator != 1 else str(f.numerator)


def derive_with_representation(heirs: Heirs, config: RuleSetConfig) -> DeriveResult:
    reps = heirs.representatives
    for rp in reps:
        if rp.replacing not in _SUPPORTED:
            raise UnsupportedConfiguration(
                f"Representation of a predeceased {rp.replacing.label_id} is not supported "
                f"in v1 — only a predeceased son or daughter (KHI Pasal 185). Please consult "
                f"an ustadz/PPAIW for this configuration.",
                ruleset=config.key.value,
            )
        if rp.sons < 0 or rp.daughters < 0 or (rp.sons + rp.daughters) == 0:
            raise UnsupportedConfiguration(
                "A representative branch must have at least one child (grandson/granddaughter).",
                ruleset=config.key.value,
            )

    reps_son = [rp for rp in reps if rp.replacing == R.SON]
    reps_dtr = [rp for rp in reps if rp.replacing == R.DAUGHTER]

    augmented = replace(
        heirs,
        sons=heirs.sons + len(reps_son),
        daughters=heirs.daughters + len(reps_dtr),
        representatives=(),
    )
    base = derive(augmented, config)

    src = config.source_for("representation")
    awards: list[Award] = []
    steps = list(base.steps)

    plan = {R.SON: (heirs.sons, reps_son), R.DAUGHTER: (heirs.daughters, reps_dtr)}

    for a in base.awards:
        living_count, branch_reps = plan.get(a.relation, (None, []))
        if not branch_reps:
            awards.append(a)
            continue
        per_head = a.share / a.count  # augmented count includes the virtual parents
        if living_count and living_count > 0:
            awards.append(
                replace(
                    a,
                    count=living_count,
                    share=per_head * living_count,
                    reason=a.reason + f" (bagian per orang {_frac(per_head)}).",
                )
            )
        for rp in branch_reps:
            _add_branch(awards, per_head, rp, a.relation, src, steps)

    steps.append(
        DerivationStep(
            step="representation",
            title="Ahli waris pengganti (KHI Pasal 185)",
            detail=(
                "Anak yang telah meninggal lebih dulu diperhitungkan seolah masih hidup untuk "
                "menentukan besar bagian, lalu bagian itu diberikan kepada keturunannya (dibagi "
                "2:1 antara cucu laki-laki dan perempuan), tidak melebihi bagian ahli waris "
                "sederajat yang digantikan."
            ),
            source_id=src,
        )
    )

    notes = list(base.notes)
    notes.append(
        "Diterapkan ahli waris pengganti (KHI Pasal 185) — konsep ini TIDAK ada dalam fiqh "
        "Syafi'i klasik; pada mode Syafi'i cucu tersebut umumnya terhalang atau masuk dzawil "
        "arham (lihat mode Syafi'i untuk perbandingan)."
    )

    base_pm = 1
    for a in awards:
        base_pm = base_pm * a.share.denominator // gcd(base_pm, a.share.denominator)

    return DeriveResult(
        awards=awards,
        blocked=base.blocked,
        steps=steps,
        notes=notes,
        present=base.present,
        pokok_masalah=base_pm,
        aul_base=base.aul_base,
        radd_applied=base.radd_applied,
        baitul_mal_share=base.baitul_mal_share,
    )


def _add_branch(
    awards: list[Award],
    branch_share: Fraction,
    rep,
    parent_rel: Relation,
    source: str,
    steps: list[DerivationStep],
) -> None:
    units = 2 * rep.sons + rep.daughters
    unit = branch_share / units
    parent_label = parent_rel.label_id
    if rep.sons > 0:
        awards.append(
            Award(
                relation=R.GRANDSON_VIA_SON,
                count=rep.sons,
                share=unit * 2 * rep.sons,
                category=ShareCategory.ASABAH,
                rule_applied="representation:grandson",
                reason=f"Cucu laki-laki sebagai ahli waris pengganti dari {parent_label} yang "
                f"telah wafat (menerima bagian {parent_label}, dibagi 2:1).",
                source_id=source,
                asabah_type=AsabahType.BIGHAIRIHI if rep.daughters else AsabahType.BINAFSIHI,
            )
        )
    if rep.daughters > 0:
        awards.append(
            Award(
                relation=R.GRANDDAUGHTER_VIA_SON,
                count=rep.daughters,
                share=unit * rep.daughters,
                category=ShareCategory.ASABAH,
                rule_applied="representation:granddaughter",
                reason=f"Cucu perempuan sebagai ahli waris pengganti dari {parent_label} yang "
                f"telah wafat.",
                source_id=source,
            )
        )
