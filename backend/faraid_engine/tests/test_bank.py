"""Validation test bank (PRD §6) — ≥50 worked examples, 100% pass is the Tier-1 gate.

Every expected answer here is derived by hand from the fara'id rules (share values are
the independent check, NOT an echo of the engine) and grouped by case type. Where a
value could not be verified independently it is NOT included — per CLAUDE.md, an
unverified fixture is flagged, never trusted.

Covered: simple spouse/children, parents+children, the two umariyyatan (gharrawain),
grandparents & their hajb, kalalah (all sibling classes), asabah bi nafsihi/bi ghairihi/
ma'a ghairihi, grandchildren via son (incl. 1/6 completion), every valid 'aul base
(7/8/9/10, 13/15/17, 27), and radd scenarios.
"""

from __future__ import annotations

from fractions import Fraction as F

import pytest

from faraid_engine import Heirs, Ruleset
from ._helpers import Case, run_case

K = Ruleset.KHI
S = Ruleset.SYAFII
R = __import__("faraid_engine", fromlist=["Relation"]).Relation

CASES: list[Case] = [
    # --- A. Spouse only / spouse + children -----------------------------------
    Case("husband alone (Syafii → baitul mal)", Heirs(husband=True), S,
         {R.HUSBAND: F(1, 2)}, baitul_mal=F(1, 2), radd=False,
         note="Spouse excluded from radd; classical routes surplus to baitul mal."),
    Case("husband alone (KHI → radd to sole spouse)", Heirs(husband=True), K,
         {R.HUSBAND: F(1)}, radd=True,
         note="KHI practice: sole surviving spouse takes all by radd."),
    Case("wife alone (KHI → radd)", Heirs(wives=1), K, {R.WIFE: F(1)}, radd=True),
    Case("husband + 1 son", Heirs(husband=True, sons=1), K,
         {R.HUSBAND: F(1, 4), R.SON: F(3, 4)}),
    Case("wife + 1 son", Heirs(wives=1, sons=1), K,
         {R.WIFE: F(1, 8), R.SON: F(7, 8)}),
    Case("husband + 1 daughter (radd to daughter)", Heirs(husband=True, daughters=1), S,
         {R.HUSBAND: F(1, 4), R.DAUGHTER: F(3, 4)}, radd=True),
    Case("wife + 2 daughters (radd to daughters)", Heirs(wives=1, daughters=2), K,
         {R.WIFE: F(1, 8), R.DAUGHTER: F(7, 8)}, radd=True),
    Case("husband + 2 sons", Heirs(husband=True, sons=2), K,
         {R.HUSBAND: F(1, 4), R.SON: F(3, 4)}),
    Case("wife + son + 2 daughters", Heirs(wives=1, sons=1, daughters=2), K,
         {R.WIFE: F(1, 8), R.SON: F(7, 16), R.DAUGHTER: F(7, 16)}),
    Case("son + daughter", Heirs(sons=1, daughters=1), S,
         {R.SON: F(2, 3), R.DAUGHTER: F(1, 3)}),
    Case("2 daughters only (radd)", Heirs(daughters=2), K, {R.DAUGHTER: F(1)}, radd=True),
    Case("1 daughter only (radd)", Heirs(daughters=1), K, {R.DAUGHTER: F(1)}, radd=True),
    Case("husband + son + daughter", Heirs(husband=True, sons=1, daughters=1), K,
         {R.HUSBAND: F(1, 4), R.SON: F(1, 2), R.DAUGHTER: F(1, 4)}),
    Case("2 sons + 2 daughters", Heirs(sons=2, daughters=2), S,
         {R.SON: F(2, 3), R.DAUGHTER: F(1, 3)}),

    # --- B. Parents + children ------------------------------------------------
    Case("son + father + mother", Heirs(sons=1, father=True, mother=True), K,
         {R.FATHER: F(1, 6), R.MOTHER: F(1, 6), R.SON: F(2, 3)}),
    Case("daughter + father + mother (father furud+asabah)",
         Heirs(daughters=1, father=True, mother=True), K,
         {R.DAUGHTER: F(1, 2), R.MOTHER: F(1, 6), R.FATHER: F(1, 3)}),
    Case("father + mother only", Heirs(father=True, mother=True), S,
         {R.MOTHER: F(1, 3), R.FATHER: F(2, 3)}),
    Case("father alone", Heirs(father=True), S, {R.FATHER: F(1)}),
    Case("mother alone (radd)", Heirs(mother=True), K, {R.MOTHER: F(1)}, radd=True),
    Case("son + mother", Heirs(sons=1, mother=True), K,
         {R.MOTHER: F(1, 6), R.SON: F(5, 6)}),
    Case("son + father", Heirs(sons=1, father=True), K,
         {R.FATHER: F(1, 6), R.SON: F(5, 6)}),
    Case("father + mother + 2 sons", Heirs(father=True, mother=True, sons=2), K,
         {R.FATHER: F(1, 6), R.MOTHER: F(1, 6), R.SON: F(2, 3)}),
    Case("mother + father + son + daughter",
         Heirs(mother=True, father=True, sons=1, daughters=1), K,
         {R.FATHER: F(1, 6), R.MOTHER: F(1, 6), R.SON: F(4, 9), R.DAUGHTER: F(2, 9)}),
    Case("wife + father + son", Heirs(wives=1, father=True, sons=1), K,
         {R.WIFE: F(1, 8), R.FATHER: F(1, 6), R.SON: F(17, 24)}),

    # --- C. Gharrawain / umariyyatan (mother = 1/3 of the remainder) ----------
    Case("husband + father + mother (gharrawain)", Heirs(husband=True, father=True, mother=True), S,
         {R.HUSBAND: F(1, 2), R.MOTHER: F(1, 6), R.FATHER: F(1, 3)},
         note="Umariyyah: mother 1/3 of (1 − 1/2) = 1/6."),
    Case("wife + father + mother (gharrawain)", Heirs(wives=1, father=True, mother=True), S,
         {R.WIFE: F(1, 4), R.MOTHER: F(1, 4), R.FATHER: F(1, 2)},
         note="Umariyyah: mother 1/3 of (1 − 1/4) = 1/4."),

    # --- D. Grandparents & their hajb -----------------------------------------
    Case("son + paternal grandfather", Heirs(sons=1, paternal_grandfather=True), K,
         {R.PATERNAL_GRANDFATHER: F(1, 6), R.SON: F(5, 6)},
         note="Grandfather substitutes father (1/6 with male descendant)."),
    Case("son + maternal grandmother", Heirs(sons=1, maternal_grandmother=True), K,
         {R.MATERNAL_GRANDMOTHER: F(1, 6), R.SON: F(5, 6)}),
    Case("son + both grandmothers (share 1/6)",
         Heirs(sons=1, paternal_grandmother=True, maternal_grandmother=True), K,
         {R.PATERNAL_GRANDMOTHER: F(1, 12), R.MATERNAL_GRANDMOTHER: F(1, 12), R.SON: F(5, 6)}),
    Case("father blocks paternal grandfather", Heirs(father=True, paternal_grandfather=True, sons=1), K,
         {R.FATHER: F(1, 6), R.SON: F(5, 6)}, blocked={R.PATERNAL_GRANDFATHER}),
    Case("mother blocks maternal grandmother", Heirs(mother=True, maternal_grandmother=True, sons=1), K,
         {R.MOTHER: F(1, 6), R.SON: F(5, 6)}, blocked={R.MATERNAL_GRANDMOTHER}),

    # --- E. Kalalah — siblings -------------------------------------------------
    Case("1 maternal sibling only (radd)", Heirs(maternal_siblings=1), K,
         {R.MATERNAL_SIBLING: F(1)}, radd=True),
    Case("2 maternal siblings only (radd)", Heirs(maternal_siblings=2), K,
         {R.MATERNAL_SIBLING: F(1)}, radd=True),
    Case("1 full sister only (radd)", Heirs(full_sisters=1), K, {R.FULL_SISTER: F(1)}, radd=True),
    Case("2 full sisters only (radd)", Heirs(full_sisters=2), K, {R.FULL_SISTER: F(1)}, radd=True),
    Case("full brother only", Heirs(full_brothers=1), S, {R.FULL_BROTHER: F(1)}),
    Case("full brother + full sister (2:1)", Heirs(full_brothers=1, full_sisters=1), S,
         {R.FULL_BROTHER: F(2, 3), R.FULL_SISTER: F(1, 3)}),
    Case("husband + full sister (exact)", Heirs(husband=True, full_sisters=1), S,
         {R.HUSBAND: F(1, 2), R.FULL_SISTER: F(1, 2)}),
    Case("paternal sister only (radd)", Heirs(paternal_sisters=1), K,
         {R.PATERNAL_SISTER: F(1)}, radd=True),
    Case("full sister + paternal sister completion (radd)",
         Heirs(full_sisters=1, paternal_sisters=1), K,
         {R.FULL_SISTER: F(3, 4), R.PATERNAL_SISTER: F(1, 4)}, radd=True,
         note="Full sister 1/2, paternal sister 1/6 completion, then radd 3:1."),
    Case("2 full sisters block paternal sister", Heirs(full_sisters=2, paternal_sisters=1), K,
         {R.FULL_SISTER: F(1)}, radd=True, blocked={R.PATERNAL_SISTER}),

    # --- F. Asabah ma'a ghairihi (sister residuary with a female descendant) --
    Case("daughter + full sister (ma'a ghairihi)", Heirs(daughters=1, full_sisters=1), S,
         {R.DAUGHTER: F(1, 2), R.FULL_SISTER: F(1, 2)}),
    Case("2 daughters + full sister (ma'a ghairihi)", Heirs(daughters=2, full_sisters=1), S,
         {R.DAUGHTER: F(2, 3), R.FULL_SISTER: F(1, 3)}),
    Case("daughter + paternal sister (ma'a ghairihi)", Heirs(daughters=1, paternal_sisters=1), S,
         {R.DAUGHTER: F(1, 2), R.PATERNAL_SISTER: F(1, 2)}),
    Case("daughter + full sister blocks paternal sister",
         Heirs(daughters=1, full_sisters=1, paternal_sisters=1), S,
         {R.DAUGHTER: F(1, 2), R.FULL_SISTER: F(1, 2)}, blocked={R.PATERNAL_SISTER}),

    # --- G. Grandchildren via son ---------------------------------------------
    Case("1 daughter + 1 granddaughter (1/6 completion, radd)",
         Heirs(daughters=1, granddaughters_via_son=1), K,
         {R.DAUGHTER: F(3, 4), R.GRANDDAUGHTER_VIA_SON: F(1, 4)}, radd=True),
    Case("1 daughter + grandson + granddaughter", Heirs(daughters=1, grandsons_via_son=1, granddaughters_via_son=1), K,
         {R.DAUGHTER: F(1, 2), R.GRANDSON_VIA_SON: F(1, 3), R.GRANDDAUGHTER_VIA_SON: F(1, 6)}),
    Case("2 daughters + grandson + granddaughter (residue)",
         Heirs(daughters=2, grandsons_via_son=1, granddaughters_via_son=1), K,
         {R.DAUGHTER: F(2, 3), R.GRANDSON_VIA_SON: F(2, 9), R.GRANDDAUGHTER_VIA_SON: F(1, 9)}),
    Case("granddaughter via son alone (radd)", Heirs(granddaughters_via_son=1), K,
         {R.GRANDDAUGHTER_VIA_SON: F(1)}, radd=True),
    Case("2 daughters block granddaughter", Heirs(daughters=2, granddaughters_via_son=1), K,
         {R.DAUGHTER: F(1)}, radd=True, blocked={R.GRANDDAUGHTER_VIA_SON}),

    # --- H. 'Aul — every valid base -------------------------------------------
    Case("aul 6→7 (husband + full sister + maternal sibling)",
         Heirs(husband=True, full_sisters=1, maternal_siblings=1), S,
         {R.HUSBAND: F(3, 7), R.FULL_SISTER: F(3, 7), R.MATERNAL_SIBLING: F(1, 7)}, aul_base=7),
    Case("aul 6→8 (husband + 2 full sisters + maternal sibling)",
         Heirs(husband=True, full_sisters=2, maternal_siblings=1), S,
         {R.HUSBAND: F(3, 8), R.FULL_SISTER: F(1, 2), R.MATERNAL_SIBLING: F(1, 8)}, aul_base=8),
    Case("aul 6→9 (husband + 2 full sisters + 2 maternal siblings)",
         Heirs(husband=True, full_sisters=2, maternal_siblings=2), S,
         {R.HUSBAND: F(1, 3), R.FULL_SISTER: F(4, 9), R.MATERNAL_SIBLING: F(2, 9)}, aul_base=9),
    Case("aul 6→10 (husband + mother + 2 full sisters + 2 maternal siblings)",
         Heirs(husband=True, mother=True, full_sisters=2, maternal_siblings=2), S,
         {R.HUSBAND: F(3, 10), R.MOTHER: F(1, 10), R.FULL_SISTER: F(2, 5), R.MATERNAL_SIBLING: F(1, 5)}, aul_base=10),
    Case("aul 12→13 (wife + 2 full sisters + mother)",
         Heirs(wives=1, full_sisters=2, mother=True), S,
         {R.WIFE: F(3, 13), R.FULL_SISTER: F(8, 13), R.MOTHER: F(2, 13)}, aul_base=13),
    Case("aul 12→15 (husband + 3 daughters + father + mother)",
         Heirs(husband=True, daughters=3, father=True, mother=True), K,
         {R.HUSBAND: F(1, 5), R.DAUGHTER: F(8, 15), R.FATHER: F(2, 15), R.MOTHER: F(2, 15)}, aul_base=15),
    Case("aul 12→17 (wife + mother + 2 full sisters + 2 maternal siblings)",
         Heirs(wives=1, mother=True, full_sisters=2, maternal_siblings=2), S,
         {R.WIFE: F(3, 17), R.MOTHER: F(2, 17), R.FULL_SISTER: F(8, 17), R.MATERNAL_SIBLING: F(4, 17)}, aul_base=17),
    Case("aul 24→27 (wife + 2 daughters + father + mother)",
         Heirs(wives=1, daughters=2, father=True, mother=True), K,
         {R.WIFE: F(1, 9), R.DAUGHTER: F(16, 27), R.FATHER: F(4, 27), R.MOTHER: F(4, 27)}, aul_base=27,
         note="The classic 'mimbariyya'-family 24→27 over-subscription."),

    # --- I. Radd (mixed) -------------------------------------------------------
    Case("mother + 2 daughters (radd 1:4)", Heirs(mother=True, daughters=2), K,
         {R.MOTHER: F(1, 5), R.DAUGHTER: F(4, 5)}, radd=True),
    Case("mother + daughter (radd)", Heirs(mother=True, daughters=1), K,
         {R.MOTHER: F(1, 4), R.DAUGHTER: F(3, 4)}, radd=True),
    Case("wife + mother + daughter (spouse excluded from radd)",
         Heirs(wives=1, mother=True, daughters=1), K,
         {R.WIFE: F(1, 8), R.MOTHER: F(7, 32), R.DAUGHTER: F(21, 32)}, radd=True,
         note="Wife fixed 1/8; surplus radd to mother(1/6):daughter(1/2)=1:3 over 7/8."),
]


@pytest.mark.parametrize("case", CASES, ids=[c.name for c in CASES])
def test_validation_bank(case: Case) -> None:
    run_case(case)


def test_bank_has_at_least_50_cases() -> None:
    assert len(CASES) >= 50, f"PRD §6 requires ≥50 worked examples; have {len(CASES)}."
