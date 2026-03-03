# Load Testing (k6)

**Last updated:** March 2026

Load tests use [k6](https://k6.io/) to confirm the backend can handle 200+ concurrent users.

## Prerequisites

Install k6:

- **macOS:** `brew install k6`
- **Linux:** see [k6 installation](https://k6.io/docs/get-started/installation/)
- **Windows:** `choco install k6` or use the binary from k6.io

## Run the test

From the repo root, with the **backend** running (e.g. `cd backend && npm run dev`):

```bash
# Default target: http://localhost:3000 (backend)
k6 run scripts/load/load-test.js

# Custom base URL (e.g. staging)
BASE_URL=https://your-backend.example.com k6 run scripts/load/load-test.js
```

From the `backend` folder you can use:

```bash
npm run load-test
```

(Still targets `BASE_URL`; set it if your backend is not on port 3000.)

## Script configuration

- **VUs:** 200 virtual users
- **Duration:** 2 minutes
- **Endpoints:** `GET /health`, `GET /api/games/active`, `GET /api/games/pending`
- **Thresholds:** 95th percentile latency < 3s, error rate < 5%

Adjust `scripts/load/load-test.js` to change VUs, duration, or add more endpoints.
