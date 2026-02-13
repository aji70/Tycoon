import Chain from "../models/Chain.js";

export const createChain = async (req, res) => {
  try {
    const chainData = req.body;
    const chain = await Chain.create(chainData);
    res.status(201).json(chain);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getChains = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const chains = await Chain.getAll(
      Number.parseInt(limit),
      Number.parseInt(offset)
    );
    res.json(chains);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getChainById = async (req, res) => {
  try {
    const { id } = req.params;
    const chain = await Chain.findById(id);

    if (!chain) {
      return res.status(400).json({ error: "Chain not found" });
    }

    res.json(chain);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateChain = async (req, res) => {
  try {
    const { id } = req.params;
    const chain = await Chain.findById(id);

    if (!chain) {
      return res.status(400).json({ error: "Chain not found" });
    }

    const updatedChain = await Chain.update(id, req.body);
    res.json(updatedChain);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteChain = async (req, res) => {
  try {
    const { id } = req.params;
    const chain = await Chain.findById(id);

    if (!chain) {
      return res.status(400).json({ error: "Chain not found" });
    }

    await Chain.delete(id);
    res.json({ message: "Chain deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
