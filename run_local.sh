#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=============================================="
echo " Starting Auto-Matter Local Development Server"
echo "=============================================="

# Determine Python executable
if [ -f "$ROOT_DIR/.venv/bin/python" ]; then
  PYTHON="$ROOT_DIR/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="python3"
else
  PYTHON="python"
fi

# Load environment variables if .env exists
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi


# 1. Free ports if occupied from prior runs
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true

# 2. Start FastAPI Backend on Port 8000
echo "--> Starting Backend on http://localhost:8000..."
$PYTHON -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Ensure backend process is terminated when this script exits
cleanup() {
  echo ""
  echo "--> Shutting down services..."
  kill $BACKEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup EXIT INT TERM

# Wait for backend to be ready
echo "--> Waiting for backend health check..."
for i in {1..30}; do
  if curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
    echo "--> Backend is healthy and ready!"
    break
  fi
  sleep 0.5
done

# 3. Start Next.js Frontend on Port 3000
echo "--> Starting Frontend on http://localhost:3000..."
cd "$ROOT_DIR/frontend"
npm run dev
