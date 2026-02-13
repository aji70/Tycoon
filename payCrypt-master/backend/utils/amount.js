import axios from "axios";
import { parseUnits, formatUnits } from "ethers";

export const cryptoPrice = async (token) => {
  const { data } = await axios.get(
    `https://crypto-market-prices.p.rapidapi.com/tokens/${token}`,
    {
      params: { base: "USDT" },
      headers: {
        "x-rapidapi-host": "crypto-market-prices.p.rapidapi.com",
        "x-rapidapi-key": "79fbab5ca1msh81d455757c24694p13abfejsn973b551f4163",
      },
    }
  );
  if (!data.error && data.message.toLowerCase() === "success" && data.data) {
    return data.data.price;
  }
  return null;
};

export const cryptoToFiat = async (token, amount) => {
  const crypto_price = await cryptoPrice(token);
  if (crypto_price) {
    return amount * crypto_price;
  }
  return null;
};

export const from18Decimals = (value) => {
  return formatUnits(value, 18);
};

export const to18Decimals = (value) => {
  return parseUnits(value, 18).toString();
};
