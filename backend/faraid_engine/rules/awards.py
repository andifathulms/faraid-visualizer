"""Internal working types used while the pipeline computes.

An :class:`Award` is the mutable in-flight version of a
:class:`~faraid_engine.results.HeirShare`; the pipeline mutates fractions during 'aul/
radd, then freezes each award into a HeirShare at the end. Keeping the working type
separate from the frozen result type keeps the public API immutable while the algorithm
stays readable.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction

from ..heirs import Relation
from ..results import AsabahType, HeirShare, ShareCategory


@dataclass
class Award:
    relation: Relation
    count: int
    share: Fraction
    category: ShareCategory
    rule_applied: str
    reason: str
    source_id: str
    asabah_type: AsabahType | None = None

    def to_heir_share(self) -> HeirShare:
        per_head = self.share / self.count if self.count else self.share
        return HeirShare(
            relation=self.relation,
            count=self.count,
            share=self.share,
            per_head=per_head,
            category=self.category,
            rule_applied=self.rule_applied,
            reason=self.reason,
            source_id=self.source_id,
            asabah_type=self.asabah_type,
        )
