/**
 * Encrypt/decrypt API keys for user agents at rest.
 * Uses AES-256-GCM. Set AGENT_API_KEY_SECRET (32+ bytes hex or any string, will be derived).
 */

import crypto from "crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;
const SALT = "tycoon-agent-key-v1";

function getKey() {
  const secret = process.env.AGENT_API_KEY_SECRET;
  if (!secret || typeof secret !== "string") return null;
  if (secret.length >= 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret.slice(0, 64), "hex");
  }
  return crypto.scryptSync(secret, SALT, KEY_LEN);
}

/**
 * @param {string} plaintext
 * @returns {string|null} base64(iv + authTag + ciphertext) or null if encryption unavailable
 */
export function encrypt(plaintext) {
  const key = getKey();
  if (!key || !plaintext) return null;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv, { authTagLength: AUTH_TAG_LEN });
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * @param {string} ciphertext base64(iv + authTag + ciphertext)
 * @returns {string|null} plaintext or null
 */
export function decrypt(ciphertext) {
  const key = getKey();
  if (!key || !ciphertext) return null;
  try {
    const buf = Buffer.from(ciphertext, "base64");
    if (buf.length < IV_LEN + AUTH_TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const enc = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = crypto.createDecipheriv(ALG, key, iv, { authTagLength: AUTH_TAG_LEN });
    decipher.setAuthTag(tag);
    return decipher.update(enc) + decipher.final("utf8");
  } catch {
    return null;
  }
}

export function isEncryptionAvailable() {
  return !!getKey();
}
