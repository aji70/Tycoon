import db from "./database.js";
import pLimit from "p-limit";
import * as freecryptoapi from "../services/free-crypto-api.js";
import * as exchangerateapi from "../services/exchange-rate-api.js";
import redis from "./redis.js";

const limit = pLimit(5);

export const updateTokenPrices = async () => {
  try {
    console.log("⏳ Updating token prices...");

    const tokens = await db("tokens").select("id", "symbol");

    // Create tasks with throttling
    const tasks = tokens.map((token) =>
      limit(async () => {
        try {
          const data = await freecryptoapi.rate(token.symbol);
          const price = data?.last ? Number.parseFloat(data.last) : null;

          if (price && !Number.isNaN(price)) {
            await db("tokens").where({ id: token.id }).update({
              price: price,
              updated_at: new Date(),
            });

            console.log(`✅ Updated ${token.symbol}: ${price}`);
          } else {
            console.warn(`⚠️ Skipping ${token.symbol}, invalid price`);
          }
        } catch (err) {
          console.error(`❌ Error updating ${token.symbol}:`, err.message);
        }
      })
    );

    // Run all tasks with concurrency control
    const results = await Promise.allSettled(tasks);

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failCount = results.length - successCount;

    console.log(
      `📊 Token price update done: ${successCount} success, ${failCount} failed`
    );
  } catch (err) {
    console.error("❌ Error in updateTokenPrices:", err.message);
  }
};

export const NGN_KEY = "USD_NGN";
export const SIX_HOURS = 6 * 60 * 60;

export const updateNgnRate = async () => {
  try {
    console.log("⏳ Fetching USD->NGN rate...");

    // Call the exchange API with USD
    const data = await exchangerateapi.rate("USD");

    if (!data || !data.NGN) {
      throw new Error("No NGN rate found in response");
    }

    const ngnValue = Number.parseFloat(data.NGN);

    if (!Number.isNaN(ngnValue)) {
      // Save to Redis with 6h expiry
      await redis.setEx(NGN_KEY, SIX_HOURS, ngnValue.toString());

      console.log(`✅ Cached NGN rate: ${ngnValue}`);
    } else {
      console.warn(
        "⚠️ Invalid NGN value received, skipping Redis cache update"
      );
    }
  } catch (err) {
    console.error("❌ Error updating NGN rate:", err.message);
  }
};
