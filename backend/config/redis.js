import { createClient } from "redis";

const noopRedis = {
  get: async () => null,
  set: async () => undefined,
};

let realClient = null;
let useStub = false;
let errorLogged = false;

if (process.env.SKIP_REDIS === "true") {
  useStub = true;
  console.log("⏭️  Redis skipped (SKIP_REDIS=true) – using in-memory stub");
} else {
  realClient = createClient({
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    socket: {
      tls: process.env.REDIS_TLS === "true",
    },
  });

  realClient.on("connect", () => {
    console.log("✅ Connected to Redis");
  });

  realClient.on("error", (err) => {
    if (!errorLogged) {
      console.warn("❌ Redis unavailable (cache disabled):", err.message);
      errorLogged = true;
      useStub = true;
    }
  });

  (async () => {
    try {
      await realClient.connect();
    } catch (err) {
      if (!errorLogged) {
        console.warn("❌ Redis connection failed – running without cache:", err.message);
        errorLogged = true;
        useStub = true;
      }
    }
  })();
}

const redis = {
  async get(key) {
    if (useStub) return null;
    try {
      return await realClient.get(key);
    } catch {
      useStub = true;
      return null;
    }
  },
  async set(key, value) {
    if (useStub) return;
    try {
      await realClient.set(key, value);
    } catch {
      useStub = true;
    }
  },
};

export default redis;
