import Balance from "../models/Balance.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";

export const profile = async (req, res) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    res.json({
      message: "Profile fetched",
      user: userWithoutPassword,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const dashboard_summary = async (req, res) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }
    const total_balance = await Balance.totalBalanceByUser(user.id);
    const total_deposit = await Transaction.totalDepositByUser(user.id);
    const total_withdrawal = await Transaction.totalWithdrawalByUser(user.id);
    res.json({
      total_balance: total_balance[0]?.amount ? Number(total_balance[0].amount) : 0,
      total_deposit: total_deposit[0]?.amount ? Number(total_deposit[0].amount) : 0,
      total_withdrawal: total_withdrawal[0]?.amount
        ? Number(total_withdrawal[0].amount)
        : 0,
      portfolio_growth: 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const edit_profile = async (req, res) => {
  try {
    const { id } = req.user;

    const user = await User.update(id, req.body);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const users = await User.getAll(
      Number.parseInt(limit),
      Number.parseInt(offset)
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow users to update their own profile
    if (req.user.id !== Number.parseInt(id)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const user = await User.update(id, req.body);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow users to delete their own account
    if (req.user.id !== Number.parseInt(id)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // const deleted = await User.delete(id);
    // if (!deleted) {
    //   return res.status(400).json({ error: "User not found" });
    // }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
