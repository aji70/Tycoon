/**
 * List all users who were registered as guests (not wallet connect).
 * Usage: node -r dotenv/config scripts/list-guest-users.js
 * Or: npm run list:guest-users (from backend directory)
 *
 * Guest users have users.is_guest = true (set at guest-register / Privy guest sign-up).
 */
import db from "../config/database.js";

async function main() {
  const guests = await db("users")
    .where({ is_guest: true })
    .select("id", "username", "address", "chain", "created_at")
    .orderBy("id", "asc");

  console.log(`Found ${guests.length} guest user(s):\n`);
  if (guests.length === 0) {
    process.exit(0);
    return;
  }
  console.table(guests);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
