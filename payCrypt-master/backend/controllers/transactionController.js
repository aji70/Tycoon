import Transaction from "../models/Transaction.js";

export const createTransaction = async (req, res) => {
  try {
    const transactionData = {
      ...req.body,
      user_id: req.user.id,
    };

    const transaction = await Transaction.create(transactionData);
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const transactions = await Transaction.getAll(
      Number.parseInt(limit),
      Number.parseInt(offset)
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTransactionByUser = async (req, res) => {
  try {
    const { id } = req.user;
    const transactions = await Transaction.getByUser(id);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(400).json({ error: "Transaction not found" });
    }
    // Only allow ttransaction owner to view
    if (transaction.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(400).json({ error: "Transaction not found" });
    }

    // Only allow transaction owner to update
    if (transaction.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const updatedTransaction = await Transaction.update(id, req.body);
    res.json(updatedTransaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return res.status(400).json({ error: "Transaction not found" });
    }

    // Only allow transaction owner to delete
    if (transaction.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await Transaction.delete(id);
    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
