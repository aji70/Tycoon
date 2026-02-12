/**
 * Tycoon Celo Agent - HTTP server that receives decision requests from Tycoon backend.
 * Compatible with Celo "Build Agents for the Real World" hackathon (ERC-8004).
 *
 * Run: npm start
 * Register with Tycoon: npm run register (set TYCOON_API_URL, AGENT_SLOT, AGENT_CALLBACK_URL, AGENT_ID)
 */

import http from "node:http";
import { decide } from "./decisionLogic.js";

const PORT = Number(process.env.PORT) || 4077;

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/decision") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found. POST /decision only." }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const { requestId, decisionType, context } = payload;
  const result = decide(decisionType || "property", context || {});
  const response = {
    requestId,
    action: result.action,
    propertyId: result.propertyId,
    reasoning: result.reasoning,
    confidence: result.confidence,
  };

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(response));
});

server.listen(PORT, () => {
  console.log(`Tycoon Celo Agent listening on port ${PORT}`);
  console.log("POST /decision with body: { requestId, gameId, slot, decisionType, context }");
});
