import Token from "../models/Token.js";

export const createToken = async (req, res) => {
  try {
    const tokenData = req.body;
    const token = await Token.create(tokenData);
    res.status(201).json(token);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTokens = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const tokens = await Token.getAll(
      Number.parseInt(limit),
      Number.parseInt(offset)
    );
    res.json(tokens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTokenById = async (req, res) => {
  try {
    const { id } = req.params;
    const token = await Token.findById(id);

    if (!token) {
      return res.status(400).json({ error: "Token not found" });
    }

    res.json(token);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateToken = async (req, res) => {
  try {
    const { id } = req.params;
    const token = await Token.findById(id);

    if (!token) {
      return res.status(400).json({ error: "Token not found" });
    }

    const updatedToken = await Token.update(id, req.body);
    res.json(updatedToken);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteToken = async (req, res) => {
  try {
    const { id } = req.params;
    const token = await Token.findById(id);

    if (!token) {
      return res.status(400).json({ error: "Token not found" });
    }

    await Token.delete(id);
    res.json({ message: "Token deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
