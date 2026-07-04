# FaraidVisualizer backend — Django + DRF wrapping the pure faraid_engine.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DJANGO_SETTINGS_MODULE=faraid_api.settings

WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt gunicorn

COPY . .
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
