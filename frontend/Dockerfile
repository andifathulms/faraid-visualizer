# FaraidVisualizer frontend — Next.js 14 (App Router).
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* is baked at build time; the browser calls the backend at this URL, so it
# must be the HOST-mapped backend port (passed from docker-compose).
ARG NEXT_PUBLIC_API_BASE=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
