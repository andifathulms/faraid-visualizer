"""PRD §5.2 step 5: asabah (residuary distribution).

Assigns the remainder after fixed shares to the nearest residuary, applying the 2:1
male:female ratio where applicable. All three asabah types are modeled distinctly
(:class:`~faraid_engine.results.AsabahType`):

- bi nafsihi  — residuary in own right (son, father, grandfather, full/paternal brother)
- bi ghairihi — a female made residuary by a male of her class (daughter+son, etc.)
- ma'a ghairihi — a sister made residuary alongside a female descendant

Only the single nearest residuary group takes the remainder (priority order below).
"""

from __future__ import annotations

from fractions import Fraction

from ..heirs import Heirs, Relation
from ..results import AsabahType, DerivationStep, ShareCategory
from ..rulesets.base import RuleSetConfig
from .awards import Award

R = Relation


def compute_asabah(
    heirs: Heirs,
    present: dict[Relation, int],
    furud_awards: list[Award],
    config: RuleSetConfig,
) -> tuple[list[Award], list[DerivationStep], bool, Fraction]:
    """Return ``(awards, steps, asabah_assigned, residue)``.

    ``awards`` is ``furud_awards`` with any asabah awards added / merged. ``residue`` is
    the leftover fraction BEFORE asabah (negative indicates an 'aul case, handled later).
    """
    awards = list(furud_awards)
    steps: list[DerivationStep] = []
    residue = Fraction(1) - sum((a.share for a in awards), Fraction(0))

    if residue <= 0:
        # Nothing to distribute (exact, or over-subscribed → 'aul handles it).
        return awards, steps, False, residue

    female_desc = present[R.DAUGHTER] > 0 or present[R.GRANDDAUGHTER_VIA_SON] > 0
    src = config.source_for("asabah")

    # Priority-ordered candidate resolution -------------------------------------
    if present[R.SON] > 0:
        _assign_bi_ghairihi(awards, R.SON, present[R.SON], R.DAUGHTER, present[R.DAUGHTER], residue, src, steps)
    elif present[R.GRANDSON_VIA_SON] > 0:
        _assign_bi_ghairihi(awards, R.GRANDSON_VIA_SON, present[R.GRANDSON_VIA_SON],
                            R.GRANDDAUGHTER_VIA_SON, present[R.GRANDDAUGHTER_VIA_SON], residue, src, steps)
    elif present[R.FATHER] > 0:
        _assign_ascendant_residue(awards, R.FATHER, residue, config.source_for("father"), steps,
                                  "Ayah mengambil sisa sebagai asabah.")
    elif present[R.PATERNAL_GRANDFATHER] > 0:
        _assign_ascendant_residue(awards, R.PATERNAL_GRANDFATHER, residue, config.source_for("grandfather"), steps,
                                  "Kakek mengambil sisa sebagai asabah (menggantikan posisi ayah).")
    elif present[R.FULL_BROTHER] > 0:
        _assign_bi_ghairihi(awards, R.FULL_BROTHER, present[R.FULL_BROTHER],
                            R.FULL_SISTER, present[R.FULL_SISTER], residue,
                            config.source_for("full_sibling"), steps)
    elif present[R.FULL_SISTER] > 0 and female_desc:
        _assign_maa_ghairihi(awards, R.FULL_SISTER, present[R.FULL_SISTER], residue,
                            config.source_for("full_sibling"), steps,
                            "Saudari kandung menjadi asabah ma'a ghairihi bersama keturunan perempuan; "
                            "mengambil seluruh sisa.")
    elif present[R.PATERNAL_BROTHER] > 0:
        _assign_bi_ghairihi(awards, R.PATERNAL_BROTHER, present[R.PATERNAL_BROTHER],
                            R.PATERNAL_SISTER, present[R.PATERNAL_SISTER], residue,
                            config.source_for("paternal_sibling"), steps)
    elif present[R.PATERNAL_SISTER] > 0 and female_desc:
        _assign_maa_ghairihi(awards, R.PATERNAL_SISTER, present[R.PATERNAL_SISTER], residue,
                            config.source_for("paternal_sibling"), steps,
                            "Saudari seayah menjadi asabah ma'a ghairihi bersama keturunan perempuan.")
    else:
        return awards, steps, False, residue

    return awards, steps, True, residue


def _frac(f: Fraction) -> str:
    return f"{f.numerator}/{f.denominator}" if f.denominator != 1 else str(f.numerator)


def _assign_bi_ghairihi(
    awards: list[Award], male_rel: Relation, males: int, female_rel: Relation, females: int,
    residue: Fraction, source: str, steps: list[DerivationStep],
) -> None:
    """Distribute residue among males (2 shares each) and females (1 share each).

    The reason is BUILT from the counts actually present rather than passed in as a fixed
    sentence. It used to be fixed, so a case with one son and no daughters was explained
    as "sisa dibagi 2:1 dengan anak perempuan" — a 2:1 split with someone who is not in
    the case. The share was right and the sentence describing it was false, which in a
    tool whose whole claim is that the reasoning can be followed is the worse failure.

    The head count is spelled out for the same reason: "2:1" states a ratio, and the
    reader still has to work out where 3/5 came from. ``2 laki-laki × 2 + 1 perempuan = 5
    bagian`` is the missing line.
    """
    units = 2 * males + females
    unit = residue / units
    male_share = unit * 2 * males

    if females > 0:
        reason = (
            f"{male_rel.display} menjadi asabah dan mengambil sisa bersama "
            f"{female_rel.display}, dibagi 2:1 (laki-laki dua bagian, perempuan satu). "
            f"Sisa {_frac(residue)} dibagi {units} bagian "
            f"({males}×2 + {females}×1); {male_rel.display} mengambil {2 * males} bagian."
        )
        female_reason = (
            f"{female_rel.display} menjadi asabah bi ghairihi — yaitu menjadi ahli waris "
            f"sisa karena hadirnya {male_rel.display} — dan mengambil {females} dari "
            f"{units} bagian sisa."
        )
    else:
        reason = (
            f"{male_rel.display} menjadi asabah dan mengambil SELURUH sisa "
            f"({_frac(residue)}), karena tidak ada ahli waris sisa lain pada tingkat ini"
            + (f", dibagi rata di antara {males} orang." if males > 1 else ".")
        )
        female_reason = ""

    awards.append(
        Award(
            relation=male_rel, count=males, share=male_share, category=ShareCategory.ASABAH,
            rule_applied=f"asabah:bi_nafsihi:{male_rel.value}", reason=reason,
            source_id=source, asabah_type=AsabahType.BINAFSIHI,
        )
    )
    if females > 0:
        awards.append(
            Award(
                relation=female_rel, count=females, share=unit * females, category=ShareCategory.ASABAH,
                rule_applied=f"asabah:bi_ghairihi:{female_rel.value}",
                reason=female_reason,
                source_id=source, asabah_type=AsabahType.BIGHAIRIHI,
            )
        )
    steps.append(DerivationStep(step="asabah", title="Pembagian sisa (asabah)",
                                detail=reason, source_id=source,
                                data={"residue": _frac(residue), "units": units,
                                      "males": males, "females": females}))


def _assign_maa_ghairihi(
    awards: list[Award], rel: Relation, count: int, residue: Fraction,
    source: str, steps: list[DerivationStep], reason: str,
) -> None:
    awards.append(
        Award(
            relation=rel, count=count, share=residue, category=ShareCategory.ASABAH,
            rule_applied=f"asabah:maa_ghairihi:{rel.value}", reason=reason,
            source_id=source, asabah_type=AsabahType.MAAGHAIRIHI,
        )
    )
    steps.append(DerivationStep(step="asabah", title="Pembagian sisa (asabah ma'a ghairihi)",
                                detail=f"{reason} Sisa {_frac(residue)}.", source_id=source))


def _assign_ascendant_residue(
    awards: list[Award], rel: Relation, residue: Fraction, source: str,
    steps: list[DerivationStep], reason: str,
) -> None:
    """Give the residue to father/grandfather, merging with an existing 1/6 furud award."""
    for a in awards:
        if a.relation == rel:  # already has a 1/6 fixed share (female-descendant case)
            fixed = a.share
            a.share = fixed + residue
            a.category = ShareCategory.ASABAH
            a.asabah_type = AsabahType.BINAFSIHI
            a.rule_applied = f"furud+asabah:{rel.value}"
            a.reason = (
                f"{rel.label_id}: bagian tetap 1/6 ditambah sisa {_frac(residue)} sebagai "
                f"asabah = {_frac(a.share)}."
            )
            steps.append(DerivationStep(step="asabah", title="Pembagian sisa (asabah)",
                                        detail=a.reason, source_id=source))
            return
    awards.append(
        Award(relation=rel, count=1, share=residue, category=ShareCategory.ASABAH,
              rule_applied=f"asabah:bi_nafsihi:{rel.value}", reason=reason,
              source_id=source, asabah_type=AsabahType.BINAFSIHI)
    )
    steps.append(DerivationStep(step="asabah", title="Pembagian sisa (asabah)",
                                detail=f"{reason} Sisa {_frac(residue)}.", source_id=source))
