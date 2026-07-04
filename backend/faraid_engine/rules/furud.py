"""PRD §5.2 step 4: furud muqaddarah (fixed Qur'anic shares).

Assigns the fixed fractions (1/2, 1/4, 1/8, 2/3, 1/3, 1/6) to ashabul furud per the
active rule set. Residuary (asabah) heirs get NO fixed share here — they are resolved
in :mod:`faraid_engine.rules.asabah` against the remainder. The two umariyyatan
(gharrawain) cases — spouse + both parents, no descendant — are handled: the mother
takes 1/3 of the REMAINDER after the spouse, not 1/3 of the whole estate.
"""

from __future__ import annotations

from fractions import Fraction

from ..heirs import Heirs, Relation
from ..results import AsabahType, HajbEntry, ShareCategory
from ..rulesets.base import RuleSetConfig
from .awards import Award

R = Relation
HALF = Fraction(1, 2)
QUARTER = Fraction(1, 4)
EIGHTH = Fraction(1, 8)
TWO_THIRDS = Fraction(2, 3)
THIRD = Fraction(1, 3)
SIXTH = Fraction(1, 6)


def _frac(f: Fraction) -> str:
    return f"{f.numerator}/{f.denominator}" if f.denominator != 1 else str(f.numerator)


def compute_furud(
    heirs: Heirs, present: dict[Relation, int], config: RuleSetConfig
) -> tuple[list[Award], list[HajbEntry], list[str]]:
    """Return ``(furud_awards, extra_blocked, notes)``.

    ``extra_blocked`` holds sibling exclusions that only become determinable while
    computing sibling shares (e.g. paternal sisters blocked by two full sisters).
    """
    awards: list[Award] = []
    extra_blocked: list[HajbEntry] = []
    notes: list[str] = []

    sons = present[R.SON]
    daughters = present[R.DAUGHTER]
    grandsons = present[R.GRANDSON_VIA_SON]
    granddaughters = present[R.GRANDDAUGHTER_VIA_SON]
    male_desc = sons > 0 or grandsons > 0
    has_desc = male_desc or daughters > 0 or granddaughters > 0
    female_desc = (daughters > 0 or granddaughters > 0) and not male_desc

    # --- Spouse -------------------------------------------------------------------
    spouse_share = Fraction(0)
    if present[R.HUSBAND]:
        spouse_share = QUARTER if has_desc else HALF
        awards.append(
            Award(
                relation=R.HUSBAND,
                count=1,
                share=spouse_share,
                category=ShareCategory.FURUD,
                rule_applied=f"furud:husband:{_frac(spouse_share)}",
                reason=(
                    f"Suami mendapat {_frac(spouse_share)} "
                    + ("karena ada keturunan." if has_desc else "karena tidak ada keturunan.")
                ),
                source_id=_spouse_source(config, husband=True),
            )
        )
    elif present[R.WIFE]:
        total = EIGHTH if has_desc else QUARTER
        spouse_share = total
        awards.append(
            Award(
                relation=R.WIFE,
                count=present[R.WIFE],
                share=total,
                category=ShareCategory.FURUD,
                rule_applied=f"furud:wife:{_frac(total)}",
                reason=(
                    f"Istri mendapat {_frac(total)} "
                    + ("karena ada keturunan" if has_desc else "karena tidak ada keturunan")
                    + (f", dibagi rata di antara {present[R.WIFE]} istri." if present[R.WIFE] > 1 else ".")
                ),
                source_id=_spouse_source(config, husband=False),
            )
        )

    # --- Daughters (fixed share only when there is no son) ------------------------
    if sons == 0 and daughters > 0:
        share = HALF if daughters == 1 else TWO_THIRDS
        awards.append(
            Award(
                relation=R.DAUGHTER,
                count=daughters,
                share=share,
                category=ShareCategory.FURUD,
                rule_applied=f"furud:daughter:{_frac(share)}",
                reason=(
                    "Seorang anak perempuan mendapat 1/2."
                    if daughters == 1
                    else f"{daughters} anak perempuan bersama-sama mendapat 2/3, dibagi rata."
                ),
                source_id=config.source_for("daughter"),
            )
        )

    # --- Granddaughters via son (only when no son and no grandson) ----------------
    if sons == 0 and grandsons == 0 and granddaughters > 0:
        if daughters == 0:
            share = HALF if granddaughters == 1 else TWO_THIRDS
            reason = (
                "Seorang cucu perempuan mendapat 1/2 (menempati posisi anak perempuan)."
                if granddaughters == 1
                else f"{granddaughters} cucu perempuan bersama-sama mendapat 2/3."
            )
        else:  # exactly one daughter present (two+ would have blocked them in hajb)
            share = SIXTH
            reason = (
                "Cucu perempuan mendapat 1/6 sebagai penyempurna 2/3 bersama seorang anak "
                "perempuan (yang mengambil 1/2)."
            )
        awards.append(
            Award(
                relation=R.GRANDDAUGHTER_VIA_SON,
                count=granddaughters,
                share=share,
                category=ShareCategory.FURUD,
                rule_applied=f"furud:granddaughter:{_frac(share)}",
                reason=reason,
                source_id=config.source_for("granddaughter"),
            )
        )

    # --- Father -------------------------------------------------------------------
    if present[R.FATHER]:
        if config.key.value == "khi":
            notes.append(
                "Catatan KHI Pasal 177: teks harfiah memberi ayah 1/3 bila tidak ada anak, "
                "namun yurisprudensi Mahkamah Agung dan praktik KHI membaca ayah sebagai 1/6 "
                "saat ada keturunan dan sebagai asabah (sisa) bila tidak ada keturunan — "
                "itulah yang diterapkan di sini."
            )
        if male_desc:
            awards.append(_father_sixth(config))
        elif female_desc:
            # 1/6 fixed now; the residue is added in the asabah step (father is both).
            awards.append(_father_sixth(config, also_asabah=True))
        # else: pure asabah — no fixed share (handled in asabah step)

    # --- Paternal grandfather (father substitute; present only if no father) ------
    if present[R.PATERNAL_GRANDFATHER]:
        if male_desc:
            awards.append(_grandfather_sixth(config))
        elif female_desc:
            awards.append(_grandfather_sixth(config, also_asabah=True))
        # else: pure asabah — no fixed share (handled in asabah step)

    # --- Mother -------------------------------------------------------------------
    if present[R.MOTHER]:
        sibling_count = heirs.sibling_count()  # blocked siblings still reduce the mother
        if has_desc or sibling_count >= 2:
            awards.append(
                Award(
                    relation=R.MOTHER,
                    count=1,
                    share=SIXTH,
                    category=ShareCategory.FURUD,
                    rule_applied="furud:mother:1/6",
                    reason=(
                        "Ibu mendapat 1/6 karena ada keturunan."
                        if has_desc
                        else "Ibu mendapat 1/6 karena ada dua saudara atau lebih (hajb nuqshan)."
                    ),
                    source_id=config.source_for("mother"),
                )
            )
        else:
            gharrawain = (
                present[R.FATHER] and spouse_share > 0 and not has_desc and sibling_count < 2
            )
            if gharrawain:
                share = THIRD * (Fraction(1) - spouse_share)
                awards.append(
                    Award(
                        relation=R.MOTHER,
                        count=1,
                        share=share,
                        category=ShareCategory.FURUD,
                        rule_applied=f"furud:mother:gharrawain:{_frac(share)}",
                        reason=(
                            f"Kasus gharrawain (umariyyatan): ibu mendapat 1/3 dari SISA "
                            f"setelah bagian pasangan, yaitu 1/3 × (1 − {_frac(spouse_share)}) "
                            f"= {_frac(share)}. Sisanya menjadi bagian ayah sebagai asabah."
                        ),
                        source_id=config.source_for("mother"),
                    )
                )
            else:
                awards.append(
                    Award(
                        relation=R.MOTHER,
                        count=1,
                        share=THIRD,
                        category=ShareCategory.FURUD,
                        rule_applied="furud:mother:1/3",
                        reason="Ibu mendapat 1/3 karena tidak ada keturunan dan kurang dari dua saudara.",
                        source_id=config.source_for("mother"),
                    )
                )

    # --- Grandmother(s) — share 1/6 collectively ---------------------------------
    gm_present = [r for r in (R.PATERNAL_GRANDMOTHER, R.MATERNAL_GRANDMOTHER) if present[r]]
    if gm_present:
        each = SIXTH / len(gm_present)
        for r in gm_present:
            awards.append(
                Award(
                    relation=r,
                    count=1,
                    share=each,
                    category=ShareCategory.FURUD,
                    rule_applied=f"furud:grandmother:{_frac(each)}",
                    reason=(
                        "Nenek mendapat 1/6."
                        if len(gm_present) == 1
                        else f"Bagian nenek 1/6 dibagi rata di antara {len(gm_present)} nenek."
                    ),
                    source_id=config.source_for("grandmother"),
                )
            )

    # --- Maternal (uterine) siblings ---------------------------------------------
    m = present[R.MATERNAL_SIBLING]
    if m > 0:
        share = SIXTH if m == 1 else THIRD
        awards.append(
            Award(
                relation=R.MATERNAL_SIBLING,
                count=m,
                share=share,
                category=ShareCategory.FURUD,
                rule_applied=f"furud:maternal_sibling:{_frac(share)}",
                reason=(
                    "Seorang saudara seibu mendapat 1/6."
                    if m == 1
                    else f"{m} saudara seibu bersama-sama mendapat 1/3, dibagi rata tanpa "
                    "membedakan laki-laki dan perempuan."
                ),
                source_id=config.source_for("maternal_sibling"),
            )
        )

    # --- Full / paternal sisters as ashabul furud --------------------------------
    _compute_sister_furud(present, female_desc, config, awards, extra_blocked)

    return awards, extra_blocked, notes


def _spouse_source(config: RuleSetConfig, *, husband: bool) -> str:
    key = "husband" if husband else "wife"
    if key in config.sources:
        return config.source_for(key)
    return config.source_for("spouse")


def _father_sixth(config: RuleSetConfig, *, also_asabah: bool = False) -> Award:
    reason = "Ayah mendapat 1/6 karena ada keturunan laki-laki."
    if also_asabah:
        reason = (
            "Ayah mendapat 1/6 sebagai bagian tetap karena ada keturunan perempuan, "
            "sekaligus menerima sisa (asabah) bila masih ada."
        )
    return Award(
        relation=R.FATHER,
        count=1,
        share=SIXTH,
        category=ShareCategory.FURUD,
        rule_applied="furud:father:1/6",
        reason=reason,
        source_id=config.source_for("father"),
    )


def _grandfather_sixth(config: RuleSetConfig, *, also_asabah: bool = False) -> Award:
    reason = "Kakek mendapat 1/6 (menggantikan posisi ayah) karena ada keturunan laki-laki."
    if also_asabah:
        reason = (
            "Kakek mendapat 1/6 sebagai bagian tetap karena ada keturunan perempuan, "
            "sekaligus menerima sisa (asabah) bila masih ada."
        )
    return Award(
        relation=R.PATERNAL_GRANDFATHER,
        count=1,
        share=SIXTH,
        category=ShareCategory.FURUD,
        rule_applied="furud:grandfather:1/6",
        reason=reason,
        source_id=config.source_for("grandfather"),
    )


def _compute_sister_furud(
    present: dict[Relation, int],
    female_desc: bool,
    config: RuleSetConfig,
    awards: list[Award],
    extra_blocked: list[HajbEntry],
) -> None:
    """Fixed shares for full/paternal sisters (kalalah, no brother of that class).

    Sisters WITH a female descendant become asabah ma'a ghairihi (residue) and are
    resolved in the asabah step, not here. Sisters WITH a brother of their class become
    asabah bi ghairihi, also in the asabah step. This handles only the pure fixed-share
    and completion cases, and records paternal-sister exclusions in ``extra_blocked``.
    """
    full_sis = present[R.FULL_SISTER]
    full_bro = present[R.FULL_BROTHER]
    pat_sis = present[R.PATERNAL_SISTER]
    pat_bro = present[R.PATERNAL_BROTHER]

    # If a female descendant exists, sisters are asabah ma'a ghairihi (asabah step);
    # a full sister acting as asabah also blocks paternal siblings.
    if female_desc:
        if full_sis > 0 and full_bro == 0 and (pat_sis > 0 or pat_bro > 0):
            for r in (R.PATERNAL_SISTER, R.PATERNAL_BROTHER):
                if present[r] > 0:
                    extra_blocked.append(
                        HajbEntry(
                            relation=r,
                            count=present[r],
                            blocked_by=R.FULL_SISTER,
                            reason="Saudara/saudari seayah terhalang oleh saudari kandung yang "
                            "menjadi asabah ma'a ghairihi bersama keturunan perempuan.",
                            source_id=config.source_for("paternal_sibling"),
                        )
                    )
                    present[r] = 0
        return

    # No female descendant: pure kalalah fixed shares.
    if full_sis > 0 and full_bro == 0:
        share = HALF if full_sis == 1 else TWO_THIRDS
        awards.append(
            Award(
                relation=R.FULL_SISTER,
                count=full_sis,
                share=share,
                category=ShareCategory.FURUD,
                rule_applied=f"furud:full_sister:{_frac(share)}",
                reason=(
                    "Seorang saudari kandung mendapat 1/2."
                    if full_sis == 1
                    else f"{full_sis} saudari kandung bersama-sama mendapat 2/3."
                ),
                source_id=config.source_for("full_sibling"),
            )
        )
        # Paternal sisters: complete to 2/3 (1/6) after ONE full sister, else blocked —
        # unless a paternal brother is present (residue via asabah step).
        if pat_bro == 0 and pat_sis > 0:
            if full_sis == 1:
                awards.append(
                    Award(
                        relation=R.PATERNAL_SISTER,
                        count=pat_sis,
                        share=SIXTH,
                        category=ShareCategory.FURUD,
                        rule_applied="furud:paternal_sister:1/6",
                        reason="Saudari seayah mendapat 1/6 sebagai penyempurna 2/3 bersama "
                        "seorang saudari kandung (yang mengambil 1/2).",
                        source_id=config.source_for("paternal_sibling"),
                    )
                )
            else:  # two or more full sisters already took 2/3
                extra_blocked.append(
                    HajbEntry(
                        relation=R.PATERNAL_SISTER,
                        count=pat_sis,
                        blocked_by=R.FULL_SISTER,
                        reason="Saudari seayah terhalang karena dua saudari kandung atau lebih "
                        "telah mengambil 2/3.",
                        source_id=config.source_for("paternal_sibling"),
                    )
                )
                present[R.PATERNAL_SISTER] = 0
        return

    # No full siblings: paternal sisters take the fixed share directly.
    if full_sis == 0 and full_bro == 0 and pat_sis > 0 and pat_bro == 0:
        share = HALF if pat_sis == 1 else TWO_THIRDS
        awards.append(
            Award(
                relation=R.PATERNAL_SISTER,
                count=pat_sis,
                share=share,
                category=ShareCategory.FURUD,
                rule_applied=f"furud:paternal_sister:{_frac(share)}",
                reason=(
                    "Seorang saudari seayah mendapat 1/2."
                    if pat_sis == 1
                    else f"{pat_sis} saudari seayah bersama-sama mendapat 2/3."
                ),
                source_id=config.source_for("paternal_sibling"),
            )
        )
