import BankAccount from "../models/BankAccount.js";

export const getBankAccountByUserId = async (req, res) => {
  try {
    const { id } = req.user;
    const bank_account = await BankAccount.getByUserId(id);
    if (!bank_account) {
      return res.status(400).json({ error: "Bank account not found" });
    }
    res.json(bank_account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBankAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    const bank_account = await BankAccount.findById(id);

    if (!bank_account) {
      return res.status(400).json({ error: "Bank account not found" });
    }

    res.json(bank_account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const bank_account = await BankAccount.findById(id);

    if (!bank_account) {
      return res.status(400).json({ error: "Bank account not found" });
    }

    // Only allow bank_account owner to update
    if (bank_account.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const updatedBankAccount = await BankAccount.update(id, req.body);
    res.json(updatedBankAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const bank_account = await BankAccount.findById(id);

    if (!bank_account) {
      return res.status(400).json({ error: "Bank account not found" });
    }

    // Only allow bank_account owner to delete
    if (bank_account.user_id !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // await BankAccount.delete(id);
    res.json({ message: "Bank account deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
