# 🏛️ Tycoon

## 📌 Overview

Tycoon is a **fully on-chain, decentralized version of the classic Monopoly-style strategy game**, built on **Starknet** using **Dojo**. This version leverages **ZK-Rollups** for scalability and **Cairo smart contracts** to ensure a seamless, trustless gaming experience. Players can **buy, sell, and trade digital properties** securely, with game logic enforced entirely on-chain.

## ✨ Features

* **Fully On-Chain Game State** – All transactions and state updates happen on Starknet.
* **Cairo & Dojo-Powered** – Optimized for speed and efficiency using **Starknet's native game engine**.
* **Zero-Knowledge Scalability** – Low gas fees and high throughput via **Starknet’s ZK-Rollups**.
* **On-Chain Assets & Trading** – Properties are represented as **ERC721/ERC1155 NFTs** or **custom Starknet assets**.
* **Decentralized & Trustless Gameplay** – No centralized authority; game rules enforced by smart contracts.
* **Account Abstraction for Gasless Transactions** – Improves UX by handling gas fees flexibly.

## 🔧 Tech Stack

* **Starknet** – L2 blockchain for scalability
* **Cairo** – Smart contract programming language
* **Dojo** – On-chain gaming framework
* **Torii** – Indexer for game state management
* **React / Next.js** – Frontend (if applicable)

## 🚀 Getting Started

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/Tycoon.git
cd Tycoon
```

### 2️⃣ Install Dependencies

```bash
npm install  # or yarn install
```

### 3️⃣ Deploy Smart Contracts

Using **Dojo** CLI:

```bash
sozo build
sozo migrate --world <WORLD_ADDRESS> --rpc-url <STARKNET_RPC>
```

### 4️⃣ Run the Frontend

```bash
npm run dev
```

## 📜 Smart Contract Deployment

To deploy the **Dojo-based Tycoon contracts**, use:

```bash
sozo execute TycoonSystem register_player --account <ACCOUNT> --world <WORLD_ADDRESS>
```

## 📅 Roadmap

* [ ] Complete **game logic implementation** in **Cairo**
* [ ] Develop **on-chain property trading & staking**
* [ ] Integrate **Torii** for real-time indexing
* [ ] Build a **smooth, interactive UI**
* [ ] Deploy to **Starknet Mainnet**

## 🤝 Contributing

We welcome contributions! Fork the repo, submit PRs, and help build the future of **on-chain gaming**.

# Tycoon
