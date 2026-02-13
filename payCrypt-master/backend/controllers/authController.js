import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { createUserBalance } from "./balanceController.js";
import Wallet from "../models/Wallet.js";
import BankAccount from "../models/BankAccount.js";

export const register = async (req, res) => {
  try {
    const { email, tag, address, password, role } = req.body;

    // Check if user email already exists
    const existingUserEmail = await User.findByEmail(email);
    if (existingUserEmail) {
      return res.status(400).json({ error: "User email already exists" });
    }

    // Check if user tag already exists
    const existingUserTag = await User.findByTag(tag);
    if (existingUserTag) {
      return res.status(400).json({ error: "User tag already exists" });
    }
    const photo = `https://api.dicebear.com/9.x/initials/svg?seed=${tag}`;
    // Create new user
    const user = await User.create({
      email,
      tag,
      address,
      password,
      photo,
      role,
    });

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    user.password = undefined;

    const create_wallet = await Wallet.create({ user_id: user.id });

    const create_bank_account = await BankAccount.create({ user_id: user.id });

    const create_balances = await createUserBalance(user.id, tag);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await User.verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    const last_login = new Date();
    const update_user = await User.update(user.id, {
      last_login: new Date(),
    });

    user.password = undefined;

    res.json({
      message: "Login successful",
      token,
      user: { ...user, last_login },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
