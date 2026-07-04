"""Core share derivation: PRD §5.2 steps 3–8 on a set of living heirs.

Separated from the top-level pipeline so representation (KHI pengganti) can run the same
derivation on an augmented heir set. Operates purely on fractions — no estate money, no
representation. Given living heirs + a ruleset config, returns the awarded shares, the
blocking list, and the ordered derivation steps.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction

from ..exceptions import UnsupportedConfiguration
from ..heirs import Heirs, Relation
from ..results import DerivationStep, HajbEntry
from ..rulesets.base import RuleSetConfig
from .asabah import compute_asabah
from .aul import apply_aul
from .awards import Award
from .dzawil_arham import resolve_dzawil_arham
from .furud import compute_furud
from .hajb import apply_hajb
from .radd import apply_radd

_SIBLINGS = {
    Relation.FULL_BROTHER, Relation.FULL_SISTER,
    Relation.PATERNAL_BROTHER, Relation.PATERNAL_SISTER,
    Relation.MATERNAL_SIBLING,
}


@dataclass
class DeriveResult:
    awards: list[Award]
    blocked: list[HajbEntry]
    steps: list[DerivationStep]
    notes: list[str]
    present: dict[Relation, int]
    pokok_masalah: int = 1
    aul_base: int | None = None
    radd_applied: bool = False
    baitul_mal_share: Fraction = field(default_factory=lambda: Fraction(0))


def derive(heirs: Heirs, config: RuleSetConfig) -> DeriveResult:
    steps: list[DerivationStep] = []

    # Step 3 — hajb.
    present, blocked = apply_hajb(heirs, config)

    # Guard: grandfather + siblings under classical Syafi'i is the al-jadd wal-ikhwah
    # (muqasama) problem — genuinely intricate and NOT implemented. Raise rather than
    # guess (CLAUDE.md). KHI treats the grandfather like the father, so siblings are
    # already blocked in hajb and this guard does not trigger.
    if (
        not config.grandfather_blocks_siblings
        and heirs.paternal_grandfather
        and not heirs.father
        and any(present[r] for r in _SIBLINGS)
    ):
        raise UnsupportedConfiguration(
            "Grandfather together with siblings (al-jadd wa al-ikhwah / muqasama) is not "
            "implemented for classical Syafi'i in v1 — this case needs the Zaid ibn Thabit "
            "computation and should be reviewed by an ustadz. Please remove the conflict "
            "or use a supported configuration.",
            ruleset=config.key.value,
        )

    steps.append(
        DerivationStep(
            step="hajb",
            title="Penghalangan (hajb)",
            detail=(
                "Ahli waris yang terhalang: "
                + (", ".join(f"{b.relation.label_id} (oleh {b.blocked_by.label_id})" for b in blocked)
                   if blocked else "tidak ada.")
            ),
            data={"blocked": [b.relation.value for b in blocked]},
        )
    )

    # Step 4 — furud.
    furud_awards, extra_blocked, notes = compute_furud(heirs, present, config)
    blocked.extend(extra_blocked)
    if furud_awards:
        steps.append(
            DerivationStep(
                step="furud", title="Bagian tetap (furud muqaddarah)",
                detail="; ".join(a.reason for a in furud_awards),
            )
        )

    # Step 5 — asabah.
    awards, asabah_steps, asabah_assigned, residue = compute_asabah(
        heirs, present, furud_awards, config
    )
    steps.extend(asabah_steps)

    result = DeriveResult(
        awards=awards, blocked=blocked, steps=steps, notes=notes, present=present
    )

    # Steps 6–8 — 'aul / radd / dzawil arham.
    if residue < 0:  # shares exceed the estate
        awards, pokok, aul_base, aul_step = apply_aul(awards, config.source_for("aul"))
        result.awards = awards
        result.pokok_masalah = pokok
        result.aul_base = aul_base
        if aul_step:
            steps.append(aul_step)
    elif residue > 0 and not asabah_assigned:
        if not awards:
            resolve_dzawil_arham(config)  # raises UnsupportedConfiguration
        awards, radd_applied, baitul_mal, radd_steps = apply_radd(awards, config)
        result.awards = awards
        result.radd_applied = radd_applied
        result.baitul_mal_share = baitul_mal
        steps.extend(radd_steps)

    if result.pokok_masalah == 1:
        base = 1
        from math import gcd
        for a in result.awards:
            d = a.share.denominator
            base = base * d // gcd(base, d)
        result.pokok_masalah = base

    return result
