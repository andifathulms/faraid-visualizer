"""What this engine does NOT do — stated, cited, and tested.

``UnsupportedConfiguration`` protects against one failure: a heir configuration whose
*shape* the engine cannot resolve. It structurally cannot protect against the other one —
a configuration whose shape is perfectly supported while an entire doctrine is missing.
Wasiat wajibah (KHI Pasal 209) is exactly that case: a family with an adopted child
enters heirs the form accepts, and receives a clean, fully cited, complete-looking result
with no indication that a rule which applies to them was never implemented. Nothing
raised, because nothing was malformed. That is a silently incomplete answer, which is the
thing this project exists to prevent.

So the gaps are a registry rather than a comment. Each carries the citation for the
doctrine being declined — a gap the user is told about is a claim, and claims here are
cited like rules (PRD §5.3) — and each is asserted against the engine in
``faraid_engine/tests/test_coverage.py`` so the list cannot quietly rot as coverage grows.

Three kinds, and the distinction is the whole point:

* ``RAISES``       — the engine refuses this configuration outright. Self-announcing: the
  user cannot reach a number without being told. Listed for completeness.
* ``UNCAPTURABLE`` — the doctrine's heirs have no slot in the v1 input model (PRD §5.1),
  so the case cannot be entered at all. Nothing raises because nothing is submitted; the
  user simply finds no field for the person they are asking about.
* ``SILENT``       — the engine computes a complete answer that omits this doctrine. The
  dangerous one, and the reason this module is surfaced in every result rather than only
  on the references page.

Presentation text lives in :mod:`faraid_web.labels`, keyed by ``key`` — this module stays
free of UI concerns and of English, like the rest of the engine.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .rulesets.base import RuleSetConfig
from .sources import get_source


class GapKind(str, Enum):
    RAISES = "raises"              # engine refuses; the user is told at calculation time
    UNCAPTURABLE = "uncapturable"  # the heirs have no slot in the input model at all
    SILENT = "silent"              # engine answers, and the answer omits this doctrine


@dataclass(frozen=True)
class Gap:
    """One documented limit of the engine's coverage."""

    key: str
    kind: GapKind
    source_id: str
    #: Rule sets this gap applies to, decided from the config rather than hardcoded so a
    #: new rule set inherits the right gaps automatically.
    applies_to: "callable"

    def source(self):
        return get_source(self.source_id)


def _uses_muqasama(config: RuleSetConfig) -> bool:
    """Rule sets where a grandfather competes with siblings instead of blocking them.

    Only these can reach al-jadd wa al-ikhwah at all, so only these carry its gaps.
    """
    return not config.grandfather_blocks_siblings


def _is_khi(config: RuleSetConfig) -> bool:
    return config.key.value == "khi"


def _always(config: RuleSetConfig) -> bool:
    return True


KNOWN_GAPS: tuple[Gap, ...] = (
    # The silent one. Everything else in this registry announces itself.
    Gap(
        key="wasiat_wajibah",
        kind=GapKind.SILENT,
        source_id="khi-209",
        applies_to=_is_khi,
    ),
    Gap(
        key="jadd_muadda",
        kind=GapKind.RAISES,
        source_id="jadd-muqasama-zaid",
        applies_to=_uses_muqasama,
    ),
    Gap(
        key="jadd_akdariyya",
        kind=GapKind.RAISES,
        source_id="jadd-muqasama-zaid",
        applies_to=_uses_muqasama,
    ),
    Gap(
        key="jadd_with_descendant",
        kind=GapKind.RAISES,
        source_id="jadd-muqasama-zaid",
        applies_to=_uses_muqasama,
    ),
    # The v1 heir model (PRD §5.1) has no slot for a maternal grandfather, a daughter's
    # children, or a sister's children, so a dzawil-arham case cannot be entered at all —
    # the routing rule the rule sets disagree about is never even reached. Applies
    # whatever the active rule set's routing preference is.
    Gap(
        key="dzawil_arham_capture",
        kind=GapKind.UNCAPTURABLE,
        source_id="classical-dzawil-arham",
        applies_to=_always,
    ),
    Gap(
        key="representation_scope",
        kind=GapKind.RAISES,
        source_id="khi-185",
        applies_to=lambda c: c.supports_representation,
    ),
)


def gaps_for(config: RuleSetConfig) -> tuple[Gap, ...]:
    """The documented gaps that apply to ``config``, in registry order."""
    return tuple(g for g in KNOWN_GAPS if g.applies_to(config))


__all__ = ["Gap", "GapKind", "KNOWN_GAPS", "gaps_for"]
