import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: process.env.REDIS_TLS === "true", // Enable TLS if set in env
  },
});

redis.on("connect", () => {
  console.log("✅ Connected to Redis");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

// Connect right away
(async () => {
  try {
    await redis.connect();
  } catch (err) {
    console.error("❌ Redis connection failed:", err);
    process.exit(1);
  }
})();

export default redis;
