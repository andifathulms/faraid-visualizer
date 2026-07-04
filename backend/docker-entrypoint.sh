#!/usr/bin/env bash
# Migrate, seed citations + validation bank from the engine, then serve.
set -e

echo "[faraid] applying migrations…"
python manage.py migrate --noinput

echo "[faraid] seeding citation registry + validation bank…"
python manage.py seed_sources
python manage.py seed_validation_bank

echo "[faraid] starting gunicorn on 0.0.0.0:8000…"
exec gunicorn faraid_api.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 60
