"""Mirror the pytest validation bank (PRD §6) into the ValidationCase table.

    python manage.py seed_validation_bank

The pytest suite remains authoritative; this makes the bank queryable/inspectable as a
first-class deliverable (PRD §6).
"""

from __future__ import annotations

from dataclasses import asdict

from django.core.management.base import BaseCommand

from api.models import ValidationCase
from faraid_engine.tests.test_bank import CASES


class Command(BaseCommand):
    help = "Mirror the validation test bank into the ValidationCase table."

    def handle(self, *args, **options):
        count = 0
        for case in CASES:
            heirs = {k: v for k, v in asdict(case.heirs).items() if v}
            expected = {rel.value: f"{f.numerator}/{f.denominator}" for rel, f in case.expected.items()}
            ValidationCase.objects.update_or_create(
                name=case.name,
                defaults={
                    "ruleset": case.ruleset.value,
                    "heirs": heirs,
                    "expected": expected,
                    "aul_base": case.aul_base,
                    "radd": case.radd,
                    "note": case.note,
                },
            )
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Validation bank seeded: {count} cases."))
