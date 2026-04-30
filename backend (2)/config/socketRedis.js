/**
 * Redis clients for Socket.io adapter (pub/sub).
 * Only used when Redis is enabled; call connectSocketRedis() before attaching adapter.
 */
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

let pubClient = null;
let subClient = null;

export async function connectSocketRedis() {
  if (process.env.SKIP_REDIS === "true") return null;

  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  const useTls = process.env.REDIS_TLS === "true";

  pubClient = createClient({
    url,
    socket: { tls: useTls },
  });
  subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  return createAdapter(pubClient, subClient);
}

export function getSocketRedisClients() {
  return pubClient && subClient ? { pubClient, subClient } : null;
}
