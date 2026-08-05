import bcrypt from "bcrypt";
import logger from "../config/logger.js";
import { getWaRampConfig } from "./waRampConfig.js";
import { getUser, upsertUser } from "./waRampStore.js";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^\d{4,6}$/;

export function brandName() {
  return process.env.WA_RAMP_BRAND_NAME || getWaRampConfig().brandName || "Aji Ramp";
}

export function mainMenuButtons(user) {
  const name = user?.username || user?.whatsappName || "there";
  return {
    type: "buttons",
    header: brandName(),
    body: `Hey ${name} 👋\nWhat would you like to do?`,
    footer: `Max ${getWaRampConfig().maxOrderUsdc} USDC`,
    buttons: [
      { id: "menu_buy", title: "Buy USDC" },
      { id: "menu_sell", title: "Sell USDC" },
      { id: "menu_rates", title: "See rates" },
    ],
  };
}

export function welcomeButtons(contactName) {
  const greet = contactName ? `Hey ${contactName}` : "Hey there";
  return {
    type: "buttons",
    header: brandName(),
    body: [
      `${greet} 👋`,
      "",
      `${brandName()} lets you cash USDC for Naira — and buy USDC with Naira — without leaving WhatsApp.`,
      "",
      "Send crypto, get paid to your bank. Or pay Naira and receive USDC on Celo.",
      "",
      "Create a free account to start (takes about a minute).",
    ].join("\n"),
    footer: "Celo USDC ↔ NGN",
    buttons: [
      { id: "onboard_start", title: "Create account" },
      { id: "menu_rates", title: "See rates" },
      { id: "onboard_how", title: "How it works" },
    ],
  };
}

function howItWorksText() {
  return [
    `How ${brandName()} works`,
    "",
    "Sell: you send USDC on Celo → we pay NGN to your bank.",
    "Buy: you pay NGN to our account → we send USDC to your wallet.",
    "",
    "You’ll set a username, email, and PIN so only you can manage payouts.",
    "Then save your Celo address and bank details once, and trade from the menu.",
  ].join("\n");
}

/**
 * @returns {Promise<null | object | object[]>} replies if handled; null if not in onboarding
 */
export async function handleOnboarding({ phone, text, buttonId, contactName }) {
  let user;
  try {
    user = await getUser(phone);
  } catch (e) {
    logger.warn({ err: e.message }, "[wa-ramp] getUser failed during onboarding");
    return {
      type: "text",
      text: "Account setup needs a quick DB update. Operator: run npm run migrate",
    };
  }

  if (contactName) {
    try {
      user = (await upsertUser(phone, { whatsappName: contactName })) || user;
    } catch (_) {
      /* ignore */
    }
  }

  // Already onboarded → not our job (unless they tap restart somehow)
  if (user?.isOnboarded && buttonId !== "onboard_start") {
    return null;
  }

  const step = user?.onboardingStep || null;
  const config = getWaRampConfig();

  // First touch / welcome
  if (!user?.isOnboarded && (!step || step === "welcome")) {
    if (buttonId === "onboard_how") {
      return [
        { type: "text", text: howItWorksText() },
        welcomeButtons(contactName || user?.whatsappName),
      ];
    }
    if (buttonId === "menu_rates") {
      return [
        {
          type: "text",
          text: [
            "Rates (NGN per 1 USDC)",
            `• sell USDC → ₦${config.rates.sellNgn}`,
            `• buy USDC  → ₦${config.rates.buyNgn}`,
            "",
            "Create an account to trade.",
          ].join("\n"),
        },
        welcomeButtons(contactName || user?.whatsappName),
      ];
    }
    if (buttonId === "onboard_start") {
      await upsertUser(phone, {
        onboardingStep: "await_username",
        whatsappName: contactName || user?.whatsappName || null,
      });
      return {
        type: "text",
        text: "Pick a username (3–20 letters/numbers/_).\nExample: aji_okwu",
      };
    }
    // Any first message → welcome
    await upsertUser(phone, {
      onboardingStep: "welcome",
      whatsappName: contactName || user?.whatsappName || null,
    });
    return welcomeButtons(contactName || user?.whatsappName);
  }

  if (step === "await_username") {
    const username = (text || "").trim().replace(/^@/, "");
    if (!USERNAME_RE.test(username)) {
      return {
        type: "text",
        text: "Username must be 3–20 characters (letters, numbers, _). Try again:",
      };
    }
    await upsertUser(phone, { username, onboardingStep: "await_email" });
    return {
      type: "text",
      text: `Nice to meet you, ${username} ✅\n\nWhat's your email?`,
    };
  }

  if (step === "await_email") {
    const email = (text || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return { type: "text", text: "That doesn't look like an email. Try again:" };
    }
    await upsertUser(phone, { email, onboardingStep: "await_pin" });
    return {
      type: "text",
      text: [
        "Almost done.",
        "",
        "Create a 4–6 digit PIN to protect withdrawals & confirms.",
        "Don't share it with anyone.",
        "",
        "Enter your PIN:",
      ].join("\n"),
    };
  }

  if (step === "await_pin") {
    const pin = (text || "").trim();
    if (!PIN_RE.test(pin)) {
      return { type: "text", text: "PIN must be 4–6 digits. Try again:" };
    }
    const pinSetupHash = await bcrypt.hash(pin, 10);
    await upsertUser(phone, { pinSetupHash, onboardingStep: "await_pin_confirm" });
    return { type: "text", text: "Confirm your PIN (type it again):" };
  }

  if (step === "await_pin_confirm") {
    const pin = (text || "").trim();
    if (!PIN_RE.test(pin)) {
      return { type: "text", text: "PIN must be 4–6 digits. Confirm again:" };
    }
    const fresh = await getUser(phone);
    const ok = fresh?.pinSetupHash && (await bcrypt.compare(pin, fresh.pinSetupHash));
    if (!ok) {
      await upsertUser(phone, { pinSetupHash: null, onboardingStep: "await_pin" });
      return {
        type: "text",
        text: "PINs didn't match. Enter a new 4–6 digit PIN:",
      };
    }
    const pinHash = await bcrypt.hash(pin, 10);
    const done = await upsertUser(phone, {
      pinHash,
      pinSetupHash: null,
      onboardingStep: "done",
      onboardedAt: new Date(),
    });
    return [
      {
        type: "text",
        text: [
          `You're in, ${done.username} ✅`,
          "",
          `${brandName()} is ready.`,
          "Next: save a Celo wallet (for buys) and bank details (for sells) from the menu.",
        ].join("\n"),
      },
      mainMenuButtons(done),
    ];
  }

  // Fallback: restart welcome
  if (!user?.isOnboarded) {
    await upsertUser(phone, { onboardingStep: "welcome" });
    return welcomeButtons(contactName || user?.whatsappName);
  }

  return null;
}

export async function verifyUserPin(phone, pin) {
  const user = await getUser(phone);
  if (!user?.pinHash) return false;
  if (!PIN_RE.test(String(pin || ""))) return false;
  return bcrypt.compare(String(pin), user.pinHash);
}
