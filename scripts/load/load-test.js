/**
 * k6 load test — ~200 VUs to confirm backend can handle 200+ concurrent users.
 * Run: k6 run scripts/load/load-test.js
 * Target backend: BASE_URL (default http://localhost:3000)
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 * e.g. macOS: brew install k6
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  vus: 200,
  duration: "2m",
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    "health status 2xx": (r) => r.status >= 200 && r.status < 300,
  });
  if (res.json && res.json().status) {
    check(res.json(), {
      "health has status": (j) => typeof j.status === "string",
    });
  }

  sleep(0.5);

  const gamesRes = http.get(`${BASE_URL}/api/games/active?limit=20`);
  check(gamesRes, {
    "games/active status 2xx": (r) => r.status >= 200 && r.status < 300,
  });

  sleep(0.3);

  const pendingRes = http.get(`${BASE_URL}/api/games/pending?limit=20`);
  check(pendingRes, {
    "games/pending status 2xx": (r) => r.status >= 200 && r.status < 300,
  });

  sleep(0.2);
}
