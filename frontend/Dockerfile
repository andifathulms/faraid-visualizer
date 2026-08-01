# FaraidVisualizer frontend — Next.js 14 (App Router), built as a static site.
#
# There is no Node server at runtime: the rule engine runs in the browser under Pyodide,
# so the build output is plain files and nginx serves them. This is the same artifact
# GitHub Pages publishes, so the local stack exercises the deployed shape rather than a
# different one.
#
# NOTE: the build context is the REPOSITORY ROOT, not frontend/ — scripts/prepare-python.mjs
# reads the Python sources out of backend/ so the shipped engine is always the current
# source rather than a vendored copy. See docker-compose.yml.

FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

# The engine sources. Copied before the frontend so a UI-only edit does not invalidate
# this layer.
COPY backend/faraid_engine /app/backend/faraid_engine
COPY backend/faraid_web /app/backend/faraid_web

COPY frontend/ /app/frontend/

# Empty for the local stack (served from the root); GitHub Pages passes "/<repo>".
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

RUN npm run build


FROM nginx:1.27-alpine

COPY --from=build /app/frontend/out /usr/share/nginx/html

# WebAssembly must be served as application/wasm or the browser refuses to stream-compile
# it, and the 13 MB runtime is worth compressing. Both are on us: a static host provides
# no defaults we can rely on.
RUN printf '%s\n' \
    'types { application/wasm wasm; }' \
    'gzip on;' \
    'gzip_types application/wasm application/json application/javascript text/css text/html;' \
    'gzip_min_length 1024;' \
    > /etc/nginx/conf.d/wasm.conf

EXPOSE 80
