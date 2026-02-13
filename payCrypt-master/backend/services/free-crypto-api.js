import axios from "axios";
import dotenv from "dotenv";
import { correctTokenKey } from "../utils/token.js";
dotenv.config();

const FREE_CRYPTO_API_KEY = process.env.FREE_CRYPTO_API_KEY;

const api = axios.create({
  baseURL: "https://api.freecryptoapi.com/v1",
  headers: {
    Authorization: `Bearer ${FREE_CRYPTO_API_KEY}`,
    "Content-Type": "application/json",
  },
});

// ✅ Get price of crypto currency
export async function rate(token) {
  const symbol = correctTokenKey(token);
  const { data } = await api.get(`/getData?symbol=${symbol}`);
  if (
    data &&
    data.status === "success" &&
    data.symbols &&
    data.symbols.length > 0
  ) {
    return data.symbols[0];
  }
  return null;
}
