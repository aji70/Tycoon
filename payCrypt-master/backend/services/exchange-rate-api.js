import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;

const api = axios.create({
  baseURL: `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}`,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Get rate of USD
export async function rate(currency) {
  const { data } = await api.get(`/latest/${currency}`);
  if (data && data.result === "success" && data.conversion_rates) {
    return data.conversion_rates;
  }
  return { NGN: 1600 };
}
