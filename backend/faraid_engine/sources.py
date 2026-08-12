"""Citation & reference data layer.

PRD §2 / §5.3: every rule fired in the pipeline MUST carry a ``source_id`` that
resolves to a real, verifiable citation. This module is the single source of truth
for those citations. An uncited rule is a bug: :func:`get_source` raises rather than
returning a placeholder, so a rule referencing an unknown ``source_id`` fails loudly
in tests instead of shipping.

Citation policy (PRD §5.3):
- Qur'an: surah:ayah POINTER only, never reproduced ayat text.
- Hadith: reference + narrator, never reproduced matn.
- KHI: pasal number (Inpres No. 1/1991, Buku II — Hukum Kewarisan).
- Classical/contemporary fiqh: named book + author, used to cross-check rule
  *content*, never to reproduce its text.

This module has ZERO Django dependency (CLAUDE.md). The Django layer mirrors these
rows into a Postgres table for the UI; the engine itself only needs this dict.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class SourceType(str, Enum):
    QURAN = "quran"
    HADITH = "hadith"
    KHI = "khi"  # Kompilasi Hukum Islam — Inpres No. 1/1991
    CLASSICAL = "classical"  # named classical/contemporary fiqh reference
    CASE_LAW = "case_law"  # Pengadilan Agama / Mahkamah Agung jurisprudence commentary
    IJMA = "ijma"  # scholarly consensus


@dataclass(frozen=True)
class Source:
    """A single citable reference.

    ``pointer`` is the machine-friendly locator (e.g. ``"4:11"``, ``"Pasal 176"``).
    ``reference`` is the human-facing citation string rendered as a footnote.
    ``note`` optionally records a divergence/interpretation caveat that the UI must
    surface (e.g. the KHI Pasal 177 literal-vs-jurisprudence issue).
    """

    id: str
    type: SourceType
    reference: str
    pointer: str
    note: str = ""


# ---------------------------------------------------------------------------
# Qur'anic sources — the three ayat al-mawarith.
# ---------------------------------------------------------------------------
_QURAN = [
    Source(
        id="quran-nisa-11",
        type=SourceType.QURAN,
        reference="QS An-Nisa 4:11",
        pointer="4:11",
        note=(
            "Children shares (son:daughter 2:1; a single daughter 1/2; two or more "
            "daughters 2/3) and each parent 1/6 when the deceased has a child; mother "
            "1/3 when no child and no multiple siblings."
        ),
    ),
    Source(
        id="quran-nisa-12",
        type=SourceType.QURAN,
        reference="QS An-Nisa 4:12",
        pointer="4:12",
        note=(
            "Spouse shares (husband 1/2 without child, 1/4 with child; wife 1/4 without "
            "child, 1/8 with child) and maternal (uterine) siblings — one gets 1/6, two "
            "or more share 1/3 collectively."
        ),
    ),
    Source(
        id="quran-nisa-176",
        type=SourceType.QURAN,
        reference="QS An-Nisa 4:176",
        pointer="4:176",
        note=(
            "Kalalah: full/paternal sister 1/2 (single) or 2/3 (two or more); a brother "
            "takes the residue in the 2:1 male:female ratio with sisters."
        ),
    ),
]

# ---------------------------------------------------------------------------
# Hadith sources.
# ---------------------------------------------------------------------------
_HADITH = [
    Source(
        id="hadith-asabah-ibn-abbas",
        type=SourceType.HADITH,
        reference="Sahih al-Bukhari 6732 / Sahih Muslim 1615, narrated Ibn 'Abbas",
        pointer="Bukhari 6732; Muslim 1615",
        note=(
            "\"Give the fixed shares (fara'id) to those entitled to them; whatever "
            "remains goes to the nearest male ('asabah).\" Basis of the residuary rule."
        ),
    ),
    Source(
        id="hadith-grandmother-sixth",
        type=SourceType.HADITH,
        reference="Sunan Abi Dawud 2894 / Sunan al-Tirmidhi 2101, narrated al-Mughirah ibn Shu'bah",
        pointer="Abu Dawud 2894; Tirmidhi 2101",
        note="The grandmother is assigned one sixth (1/6).",
    ),
    Source(
        id="hadith-grandfather-asabah",
        type=SourceType.HADITH,
        reference="Athar of the Sahabah on al-jadd (grandfather); Fiqh al-Mawarith consensus",
        pointer="al-jadd",
        note=(
            "In the absence of the father, the paternal grandfather substitutes for him "
            "(1/6 with a descendant, otherwise residuary), per the majority position "
            "adopted by KHI and classical Syafi'i for the common cases modeled here."
        ),
    ),
]

# ---------------------------------------------------------------------------
# KHI — Kompilasi Hukum Islam, Inpres No. 1/1991, Buku II (Hukum Kewarisan).
# ---------------------------------------------------------------------------
_KHI = [
    Source(
        id="khi-171",
        type=SourceType.KHI,
        reference="KHI Pasal 171",
        pointer="Pasal 171",
        note="Definitions: pewaris, ahli waris, harta warisan, harta bersama.",
    ),
    Source(
        id="khi-174",
        type=SourceType.KHI,
        reference="KHI Pasal 174",
        pointer="Pasal 174",
        note="Enumeration of heirs by blood (nasab) and by marriage.",
    ),
    Source(
        id="khi-175",
        type=SourceType.KHI,
        reference="KHI Pasal 175",
        pointer="Pasal 175",
        note=(
            "Ordering of obligations on the estate: funeral costs, then debts, then "
            "wasiat (max 1/3), then division among heirs."
        ),
    ),
    Source(
        id="khi-176",
        type=SourceType.KHI,
        reference="KHI Pasal 176",
        pointer="Pasal 176",
        note=(
            "Daughter: 1/2 if sole; 2/3 if two or more; with a son the ratio is 2:1 "
            "male:female (asabah bi ghairihi)."
        ),
    ),
    Source(
        id="khi-177",
        type=SourceType.KHI,
        reference="KHI Pasal 177 (as interpreted per Mahkamah Agung jurisprudence)",
        pointer="Pasal 177",
        note=(
            "Literal text assigns the father 1/3 when there is no child, which conflicts "
            "with the fara'id system; Mahkamah Agung jurisprudence and mainstream KHI "
            "practice read the father as 1/6 when a descendant exists and residuary "
            "('asabah) otherwise — the interpretation applied by this engine. UI must "
            "surface this caveat in Professional mode."
        ),
    ),
    Source(
        id="khi-178",
        type=SourceType.KHI,
        reference="KHI Pasal 178",
        pointer="Pasal 178",
        note=(
            "Mother: 1/6 if there is a child or two or more siblings; otherwise 1/3."
        ),
    ),
    Source(
        id="khi-179",
        type=SourceType.KHI,
        reference="KHI Pasal 179",
        pointer="Pasal 179",
        note="Widower (duda): 1/2 without child, 1/4 with child.",
    ),
    Source(
        id="khi-180",
        type=SourceType.KHI,
        reference="KHI Pasal 180",
        pointer="Pasal 180",
        note="Widow (janda): 1/4 without child, 1/8 with child.",
    ),
    Source(
        id="khi-181",
        type=SourceType.KHI,
        reference="KHI Pasal 181",
        pointer="Pasal 181",
        note=(
            "Maternal (uterine) siblings: one gets 1/6, two or more share 1/3 "
            "collectively; blocked by a child or the father."
        ),
    ),
    Source(
        id="khi-182",
        type=SourceType.KHI,
        reference="KHI Pasal 182",
        pointer="Pasal 182",
        note=(
            "Full/paternal sister: 1/2 if sole, 2/3 if two or more; with a full/paternal "
            "brother the 2:1 ratio applies. Blocked by descendants and the father."
        ),
    ),
    Source(
        id="khi-185",
        type=SourceType.KHI,
        reference="KHI Pasal 185",
        pointer="Pasal 185",
        note=(
            "Ahli waris pengganti (representation): children of an heir who predeceased "
            "the deceased may step into that heir's position, capped at the share the "
            "replaced heir would have received. NO classical Syafi'i equivalent (PRD §4.1)."
        ),
    ),
    Source(
        id="khi-192",
        type=SourceType.KHI,
        reference="KHI Pasal 192",
        pointer="Pasal 192",
        note="'Aul: when fixed shares exceed the estate, shares are reduced proportionally.",
    ),
    Source(
        id="khi-193",
        type=SourceType.KHI,
        reference="KHI Pasal 193",
        pointer="Pasal 193",
        note=(
            "Radd: when fixed shares total less than the estate and no residuary heir "
            "exists, the surplus is returned proportionally to the fixed-share heirs."
        ),
    ),
    # Registered but never fired by a rule: wasiat wajibah is an explicit v1 non-goal
    # (PRD §8). It is here so faraid_engine.coverage can cite the doctrine the engine
    # declines to implement — a gap the user is told about needs a source like any rule.
    Source(
        id="khi-209",
        type=SourceType.KHI,
        reference="KHI Pasal 209",
        pointer="Pasal 209",
        note=(
            "Wasiat wajibah: an obligatory bequest of at most 1/3 between an adopted "
            "child and their adoptive parents, who do not inherit from one another under "
            "faraid. NOT implemented — see faraid_engine.coverage."
        ),
    ),
]

# ---------------------------------------------------------------------------
# Classical / contemporary fiqh references (content cross-check only).
# ---------------------------------------------------------------------------
_CLASSICAL = [
    Source(
        id="classical-fiqh-mawarith",
        type=SourceType.CLASSICAL,
        reference="Fiqh al-Mawarith (science of inheritance shares), general treatment",
        pointer="Fiqh al-Mawarith",
        note="Standard treatment of the fara'id pipeline used for content cross-check.",
    ),
    Source(
        id="classical-zuhaili",
        type=SourceType.CLASSICAL,
        reference="al-Fiqh al-Islami wa Adillatuhu — Wahbah az-Zuhaili",
        pointer="al-Fiqh al-Islami wa Adillatuhu",
        note="Cross-reference for rule content and madhab divergence; text not reproduced.",
    ),
    Source(
        id="classical-aul-umar",
        type=SourceType.IJMA,
        reference="'Aul doctrine, attributed to 'Umar ibn al-Khattab; Sahabah consensus",
        pointer="'aul",
        note=(
            "Proportional reduction of shares when the pokok masalah is over-subscribed. "
            "Valid bases: 6→7/8/9/10, 12→13/15/17, 24→27."
        ),
    ),
    Source(
        id="classical-radd-syafii",
        type=SourceType.CLASSICAL,
        reference="Radd doctrine — classical position; spouse excluded from radd (majority Sunni)",
        pointer="radd",
        note=(
            "In classical Syafi'i, when no ashabul furud remain to absorb the surplus and "
            "no asabah exist, the surplus historically routes to baitul mal rather than "
            "to the spouse. Rule-set dependent (PRD §5.2 step 7)."
        ),
    ),
    Source(
        id="classical-dzawil-arham",
        type=SourceType.CLASSICAL,
        reference="Dzawil arham routing — az-Zuhaili, comparative madhab treatment",
        pointer="dzawil arham",
        note=(
            "Reached only when no ashabul furud/asabah exist. Syafi'i/Maliki classically "
            "route to baitul mal; Hanafi/Hanbali distribute to dzawil arham (PRD §4.1)."
        ),
    ),
    Source(
        id="khi-practice-baitul-mal",
        type=SourceType.CASE_LAW,
        reference="Pengadilan Agama practice commentary on radd/dzawil arham vs. baitul mal",
        pointer="KHI practice",
        note=(
            "In current Indonesian practice a functioning baitul mal claim mechanism does "
            "not exist, so PA generally applies radd to fixed-share heirs (including the "
            "spouse where no other heir remains) rather than escheating to baitul mal. "
            "Flagged as a KHI-practice note, NOT classical Syafi'i doctrine (PRD §4.1)."
        ),
    ),
    Source(
        id="madhab-hanafi",
        type=SourceType.CLASSICAL,
        reference="Hanafi fiqh al-mawarith — Ibn 'Abidin, Radd al-Muhtar; az-Zuhaili (Hanafi positions)",
        pointer="Hanafi",
        note="General reference for Hanafi inheritance positions; text not reproduced.",
    ),
    Source(
        id="madhab-maliki",
        type=SourceType.CLASSICAL,
        reference="Maliki fiqh al-mawarith — az-Zuhaili (Maliki positions); Mukhtasar Khalil tradition",
        pointer="Maliki",
        note="General reference for Maliki inheritance positions; text not reproduced.",
    ),
    Source(
        id="madhab-hanbali",
        type=SourceType.CLASSICAL,
        reference="Hanbali fiqh al-mawarith — Ibn Qudamah, al-Mughni; az-Zuhaili (Hanbali positions)",
        pointer="Hanbali",
        note="General reference for Hanbali inheritance positions; text not reproduced.",
    ),
    Source(
        id="jadd-muqasama-zaid",
        type=SourceType.CLASSICAL,
        reference="al-jadd wa al-ikhwah (Zaid ibn Thabit's muqasama), adopted by Maliki/Syafi'i/Hanbali",
        pointer="muqasama (Zaid)",
        note=(
            "With no father, the grandfather competes with full/paternal siblings: he takes "
            "the best for him of (a) muqasama sharing as a brother, (b) 1/3 of the remainder, "
            "or (c) 1/6 of the whole when ashabul furud are present. The intricate sub-cases "
            "(akdariyya; mu'adda mixing full and paternal siblings) are not implemented and "
            "raise instead of guessing."
        ),
    ),
    Source(
        id="hanafi-jadd-blocks-siblings",
        type=SourceType.CLASSICAL,
        reference="Abu Hanifa: the grandfather blocks siblings (treated like the father)",
        pointer="al-jadd (Hanafi)",
        note=(
            "Unlike the majority (Maliki/Syafi'i/Hanbali, who apply Zaid's muqasama), Abu "
            "Hanifa gives the grandfather the father's blocking power over siblings."
        ),
    ),
    Source(
        id="radd-hanafi-hanbali",
        type=SourceType.CLASSICAL,
        reference="Radd accepted (Hanafi & Hanbali) — surplus returned to non-spouse ashabul furud",
        pointer="radd (Hanafi/Hanbali)",
        note="Spouse excluded from radd in the majority view.",
    ),
    Source(
        id="maliki-no-radd",
        type=SourceType.CLASSICAL,
        reference="Maliki: no radd — surplus escheats to baitul mal, which is treated as an heir",
        pointer="baitul mal (Maliki)",
        note=(
            "The Maliki school does not apply radd; when fixed shares are under-subscribed "
            "and no asabah exist, the remainder goes to baitul mal."
        ),
    ),
    Source(
        id="khi-harta-bersama",
        type=SourceType.CASE_LAW,
        reference="KHI Pasal 96–97 (harta bersama) applied before faraid",
        pointer="Pasal 96–97",
        note=(
            "The surviving spouse's community-property share (typically 1/2 of joint "
            "assets) is separated BEFORE faraid applies to the remainder. An Indonesian "
            "civil-law concept with no classical-fiqh equivalent; off by default in "
            "classical Syafi'i mode (PRD §4.1)."
        ),
    ),
    Source(
        id="ijma-debts-first",
        type=SourceType.IJMA,
        reference="Consensus on netting the estate (funeral, debts, wasiat) before faraid",
        pointer="tajhiz → dain → wasiat → mirath",
        note="Cross-referenced with KHI Pasal 175 for the Indonesian sequence.",
    ),
]


SOURCES: dict[str, Source] = {
    s.id: s for s in (*_QURAN, *_HADITH, *_KHI, *_CLASSICAL)
}


class UnknownSource(KeyError):
    """Raised when a rule references a ``source_id`` not in the registry."""


def get_source(source_id: str) -> Source:
    """Return the :class:`Source` for ``source_id`` or raise :class:`UnknownSource`.

    Rules must never emit a ``source_id`` that does not resolve here — that is the
    mechanism that keeps every fired rule cited (PRD §2).
    """
    try:
        return SOURCES[source_id]
    except KeyError as exc:  # pragma: no cover - trivial
        raise UnknownSource(
            f"Rule referenced unknown source_id {source_id!r}. Every rule must cite a "
            f"registered source (PRD §5.3)."
        ) from exc


def all_sources() -> list[Source]:
    """All registered sources, for fixture export into the Django citations table."""
    return list(SOURCES.values())
