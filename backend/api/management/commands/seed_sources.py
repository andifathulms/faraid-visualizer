"""Seed the Source table from the engine's authoritative citation registry.

    python manage.py seed_sources

The engine (:mod:`faraid_engine.sources`) is the single source of truth; this mirrors it
into Postgres so the DB never drifts from what the engine can actually cite.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from api.models import Source
from faraid_engine.sources import all_sources


class Command(BaseCommand):
    help = "Mirror faraid_engine citations into the Source table."

    def handle(self, *args, **options):
        created, updated = 0, 0
        for s in all_sources():
            _, was_created = Source.objects.update_or_create(
                source_id=s.id,
                defaults={
                    "type": s.type.value,
                    "reference": s.reference,
                    "pointer": s.pointer,
                    "note": s.note,
                },
            )
            created += was_created
            updated += not was_created
        self.stdout.write(
            self.style.SUCCESS(f"Sources seeded: {created} created, {updated} updated.")
        )
