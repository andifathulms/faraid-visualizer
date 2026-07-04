"""Persistence layer — citations and the validation test bank ONLY.

Per the PRD stack note, PostgreSQL stores the citation/reference tables and the
validation test bank, NOT calculation state (calculations are stateless pure functions).
These rows are seeded from :mod:`faraid_engine` via management commands so the DB always
mirrors the engine's authoritative data rather than drifting from it.
"""

from __future__ import annotations

from django.db import models


class Source(models.Model):
    """A citable reference, mirrored from :mod:`faraid_engine.sources`.

    Lets the UI query citations independently of a calculation (e.g. a references page)
    and gives non-engineers a readable table of every source the engine can cite.
    """

    source_id = models.CharField(max_length=64, primary_key=True)
    type = models.CharField(max_length=16)
    reference = models.TextField()
    pointer = models.CharField(max_length=128)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["type", "source_id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.source_id} ({self.type})"


class ValidationCase(models.Model):
    """One worked example from the validation bank (PRD §6), stored for auditability.

    The authoritative bank is the pytest suite; this table is a queryable mirror so the
    test bank is a first-class, inspectable deliverable (PRD §6) rather than only living
    in test code.
    """

    name = models.CharField(max_length=200, unique=True)
    ruleset = models.CharField(max_length=16)
    heirs = models.JSONField()
    expected = models.JSONField()
    aul_base = models.IntegerField(null=True, blank=True)
    radd = models.BooleanField(null=True, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["ruleset", "name"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.name} [{self.ruleset}]"
