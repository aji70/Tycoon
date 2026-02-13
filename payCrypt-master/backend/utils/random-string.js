import crypto from "node:crypto";

const secureRandomString = (length = 32) => {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const max = 256 - (256 % alphabet.length);
  let result = "";
  while (result.length < length) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < max) {
      result += alphabet[byte % alphabet.length];
    }
  }
  return result;
};

export default secureRandomString;
