"""PRD §5.2 step 3: hajb (blocking).

Determine which heirs are excluded by closer heirs. Renders as an explicit
"blocked because X" list — heirs are NEVER silently dropped. Only the unambiguous
total-exclusion (hajb hirman) rules live here; the finer full-vs-paternal-sibling
interactions (completion, asabah ma'a ghairihi) are resolved in
:mod:`faraid_engine.rules.furud` where the sibling shares are actually computed.
"""

from __future__ import annotations

from ..heirs import Heirs, Relation
from ..results import HajbEntry
from ..rulesets.base import RuleSetConfig

R = Relation


def apply_hajb(
    heirs: Heirs, config: RuleSetConfig
) -> tuple[dict[Relation, int], list[HajbEntry]]:
    """Return ``(present_counts, blocked)``.

    ``present_counts`` maps every relation to the number of individuals who survive
    blocking (0 if fully blocked or absent). ``blocked`` is the ordered exclusion list.
    """
    present: dict[Relation, int] = {r: heirs.count_of(r) for r in Relation}
    blocked: list[HajbEntry] = []

    def block(rel: Relation, by: Relation, reason: str, source_key: str) -> None:
        if present[rel] > 0:
            blocked.append(
                HajbEntry(
                    relation=rel,
                    count=present[rel],
                    blocked_by=by,
                    reason=reason,
                    source_id=config.source_for(source_key),
                )
            )
            present[rel] = 0

    son = heirs.sons
    grandson = heirs.grandsons_via_son
    daughter = heirs.daughters
    granddaughter = heirs.granddaughters_via_son
    father = heirs.father
    grandfather = heirs.paternal_grandfather
    mother = heirs.mother
    male_desc = son > 0 or grandson > 0
    any_desc = heirs.has_descendant()

    # Son's descendants ------------------------------------------------------------
    if son > 0:
        block(R.GRANDSON_VIA_SON, R.SON, "Cucu laki-laki (dari anak laki) terhalang oleh anak laki-laki.", "son")
        block(R.GRANDDAUGHTER_VIA_SON, R.SON, "Cucu perempuan (dari anak laki) terhalang oleh anak laki-laki.", "son")
    elif daughter >= 2 and grandson == 0:
        block(
            R.GRANDDAUGHTER_VIA_SON,
            R.DAUGHTER,
            "Cucu perempuan terhalang oleh dua anak perempuan atau lebih (yang telah "
            "mengambil 2/3) karena tidak ada cucu laki-laki yang menariknya menjadi asabah.",
            "daughter",
        )

    # Ascendants of ascendants -----------------------------------------------------
    if father:
        block(R.PATERNAL_GRANDFATHER, R.FATHER, "Kakek terhalang oleh ayah.", "grandfather")
        block(R.PATERNAL_GRANDMOTHER, R.FATHER, "Nenek dari pihak ayah terhalang oleh ayah.", "grandmother")
    elif mother:
        block(R.PATERNAL_GRANDMOTHER, R.MOTHER, "Nenek dari pihak ayah terhalang oleh ibu.", "grandmother")
    if mother:
        block(R.MATERNAL_GRANDMOTHER, R.MOTHER, "Nenek dari pihak ibu terhalang oleh ibu.", "grandmother")

    # Maternal (uterine) siblings — blocked by ANY descendant or by a male ascendant.
    if any_desc or father or grandfather:
        by = (
            R.SON if son else
            R.DAUGHTER if daughter else
            R.GRANDSON_VIA_SON if grandson else
            R.GRANDDAUGHTER_VIA_SON if granddaughter else
            R.FATHER if father else
            R.PATERNAL_GRANDFATHER
        )
        block(
            R.MATERNAL_SIBLING,
            by,
            "Saudara seibu terhalang oleh adanya keturunan (anak/cucu) atau leluhur "
            "laki-laki (ayah/kakek).",
            "maternal_sibling",
        )

    # Full siblings — blocked by a MALE descendant or the father (or grandfather in KHI).
    full_blocker = _sibling_blocker(male_desc, son, grandson, father, grandfather, config)
    if full_blocker is not None:
        block(R.FULL_BROTHER, full_blocker, "Saudara laki-laki kandung terhalang.", "full_sibling")
        block(R.FULL_SISTER, full_blocker, "Saudari kandung terhalang.", "full_sibling")

    # Paternal siblings — as full siblings, plus a full brother blocks them.
    pat_blocker = _sibling_blocker(male_desc, son, grandson, father, grandfather, config)
    if pat_blocker is None and heirs.full_brothers > 0:
        pat_blocker = R.FULL_BROTHER
    if pat_blocker is not None:
        block(R.PATERNAL_BROTHER, pat_blocker, "Saudara laki-laki seayah terhalang.", "paternal_sibling")
        block(R.PATERNAL_SISTER, pat_blocker, "Saudari seayah terhalang.", "paternal_sibling")

    return present, blocked


def _sibling_blocker(
    male_desc: bool,
    son: int,
    grandson: int,
    father: bool,
    grandfather: bool,
    config: RuleSetConfig,
) -> Relation | None:
    if male_desc:
        return R.SON if son else R.GRANDSON_VIA_SON
    if father:
        return R.FATHER
    if grandfather and config.grandfather_blocks_siblings:
        return R.PATERNAL_GRANDFATHER
    return None
