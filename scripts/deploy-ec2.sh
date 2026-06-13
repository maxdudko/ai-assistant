#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ai-assistant}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yaml}"

echo "==> Deploying from ${APP_DIR} (branch: ${BRANCH})"
cd "${APP_DIR}"

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "ERROR: ${COMPOSE_FILE} not found in ${APP_DIR}"
  exit 1
fi

if [ ! -f "apps/api/.env" ]; then
  echo "ERROR: apps/api/.env is missing"
  exit 1
fi

if [ ! -f "apps/web/.env.local" ]; then
  echo "ERROR: apps/web/.env.local is missing"
  exit 1
fi

echo "==> Updating source"
git fetch --all --prune
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "==> Building images and applying migrations"
docker compose -f "${COMPOSE_FILE}" up -d --build db
docker compose -f "${COMPOSE_FILE}" up --build migrate

echo "==> Starting API and Web"
docker compose -f "${COMPOSE_FILE}" up -d --build api web

echo "==> Current service status"
docker compose -f "${COMPOSE_FILE}" ps

echo "==> Deployment complete"
