/**
 * Generate random EVM wallets (Celo-compatible EOAs) for CELO_OPERATOR_WALLET_PRIVATE_KEYS.
 *
 * Usage (from backend/):
 *   node scripts/generate-celo-operator-wallets.js
 *   node scripts/generate-celo-operator-wallets.js --count=30
 *   node scripts/generate-celo-operator-wallets.js --count=50 --out=celo-operator-wallets.generated.json
 *
 * npm: npm run generate:celo-operator-wallets
 *
 * Never commit private keys or the --out file. Copy keys into your secrets manager / Railway env only.
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { Wallet } from "ethers";

function parseArgs() {
  let count = 50;
  let outPath = null;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--count=")) {
      const n = parseInt(arg.slice("--count=".length), 10);
      if (Number.isFinite(n) && n > 0 && n <= 500) count = n;
    } else if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length).trim() || null;
    }
  }
  const envCount = process.env.COUNT;
  if (envCount != null && String(envCount).trim() !== "") {
    const n = parseInt(envCount, 10);
    if (Number.isFinite(n) && n > 0 && n <= 500) count = n;
  }
  return { count, outPath };
}

function main() {
  const { count, outPath } = parseArgs();
  const rows = [];
  for (let i = 0; i < count; i++) {
    const w = Wallet.createRandom();
    rows.push({ index: i + 1, address: w.address, privateKey: w.privateKey });
  }

  console.error(
    `\nGenerated ${count} wallet(s). Do not commit keys or paste them into public chats.\n`
  );

  console.log("--- addresses + private keys (table) ---\n");
  console.table(rows.map(({ index, address, privateKey }) => ({ index, address, privateKey })));

  const envLine = rows.map((r) => r.privateKey).join(",");
  console.log("\n--- copy for CELO_OPERATOR_WALLET_PRIVATE_KEYS (single line) ---\n");
  console.log(envLine);
  console.log("\n--- end ---\n");

  if (outPath) {
    const abs = resolve(process.cwd(), outPath);
    const payload = {
      generatedAt: new Date().toISOString(),
      count: rows.length,
      wallets: rows.map(({ address, privateKey }) => ({ address, privateKey })),
    };
    writeFileSync(abs, JSON.stringify(payload, null, 2), "utf8");
    console.error(`Wrote ${abs} (${rows.length} wallets). Delete this file after importing keys.\n`);
  }
}

main();
