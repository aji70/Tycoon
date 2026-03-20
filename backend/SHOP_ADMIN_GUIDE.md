# Shop Admin Endpoints

These endpoints allow you to stock perks and bundles in the shop using the backend's private key to call the reward system contract.

**Base URL:** `http://localhost:3001/api/shop-admin`

## Optional auth

If `SHOP_ADMIN_SECRET` is set in the backend `.env`, every request must include header:

`x-shop-admin-secret: <same value>`

The `/rewards` admin panel can send this by setting `NEXT_PUBLIC_SHOP_ADMIN_SECRET` to the same string (internal tooling only).

## Signer & reward address

- **Signer:** `TYCOON_OWNER_PRIVATE_KEY` → else `REWARD_STOCK_MINTER_PRIVATE_KEY` → else per-chain `BACKEND_GAME_CONTROLLER_*`. The wallet must be **owner**, **backendMinter**, or **gameMinter** on `TycoonRewardSystem`.
- **Reward contract:** `REWARD_CONTRACT_ADDRESS` / `TYCOON_REWARD_SYSTEM`, or read from Tycoon `rewardSystem()` when the proxy is configured for that chain.

## Bulk one-click (Rewards UI)

### Stock all initial perks (missing only)

**POST** `/stock-all-perks`

Body: `{ "chain": "CELO", "amount": 50 }` (both optional; defaults `CELO`, `50`).

Stocks each row in `backend/config/shopStockConstants.js` (`INITIAL_COLLECTIBLES`) that is **not** already present in shop inventory (same behavior as the wallet “stock all” flow).

### Stock all preset bundles

**POST** `/stock-all-bundles`

Body: `{ "chain": "CELO" }`.

Registers every bundle in `BUNDLE_DEFS_FOR_STOCK` (must match shop). Perks must exist in the shop first.

Returns **207** if some bundles failed (see `errors` array in JSON).

## CollectiblePerk Enum Values

```
0  = NONE (unused)
1  = EXTRA_TURN (extra turn)
2  = JAIL_FREE (get out of jail free)
3  = DOUBLE_RENT (next rent payment doubled)
4  = ROLL_BOOST (bonus to dice roll)
5  = CASH_TIERED (in-game cash, uses strength 1-5)
6  = TELEPORT (move to any property)
7  = SHIELD (immune to rent/payments for 1-2 turns)
8  = PROPERTY_DISCOUNT (next purchase 30-50% off)
9  = TAX_REFUND (instant cash from bank, uses strength 1-5)
10 = ROLL_EXACT (choose exact roll 2-12 once)
11 = LUCKY_7 (roll 7: bonus cash)
12 = RENT_CASHBACK (get rent back when you pay)
13 = INTEREST (earn interest on cash balance)
14 = FREE_PARKING_BONUS (collect Free Parking jackpot)
15 = PASS_GO_EXTRA (double Go money once)
16 = BUILD_DISCOUNT (cheaper houses/hotels)
17 = ADVANCE_TO_GO (move to Go, collect salary)
18 = AUCTION_MASTER (skip auction or win at min bid)
```

## Endpoints

### 1. Stock a New Perk

**POST** `/stock-perk`

Stock a new perk in the shop. Creates a new tokenId automatically.

**Request:**
```json
{
  "amount": 100,
  "perk": 1,
  "strength": 1,
  "tycPrice": "1000000000000000000",
  "usdcPrice": "2500000"
}
```

**Parameters:**
- `amount` (number): How many units to stock (required, > 0)
- `perk` (0-18): Perk type enum value (required)
- `strength` (number): Perk strength/tier (required, > 0)
  - For CASH_TIERED (5) and TAX_REFUND (9): strength 1-5
  - For others: any value >= 1
- `tycPrice` (string): Price in TYC tokens (wei) or 0 if selling only in USDC (required if no usdcPrice)
- `usdcPrice` (string): Price in USDC tokens (wei) or 0 if selling only in TYC (required if no tycPrice)

**Example - Stock 50 Extra Turn perks for 1 TYC each:**
```bash
curl -X POST http://localhost:3001/api/shop-admin/stock-perk \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "perk": 1,
    "strength": 1,
    "tycPrice": "1000000000000000000",
    "usdcPrice": "0"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "txHash": "0x...",
    "blockNumber": 12345
  }
}
```

---

### 2. Restock an Existing Perk

**POST** `/restock-perk`

Add more stock to an existing perk.

**Request:**
```json
{
  "tokenId": 2000000000,
  "additionalAmount": 25
}
```

**Parameters:**
- `tokenId` (number): Token ID of the collectible (required)
- `additionalAmount` (number): How many more units to add (required, > 0)

**Example:**
```bash
curl -X POST http://localhost:3001/api/shop-admin/restock-perk \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": 2000000000,
    "additionalAmount": 25
  }'
```

---

### 3. Update Perk Prices

**POST** `/update-perk-prices`

Change the price of an existing perk.

**Request:**
```json
{
  "tokenId": 2000000000,
  "newTycPrice": "2000000000000000000",
  "newUsdcPrice": "5000000"
}
```

**Parameters:**
- `tokenId` (number): Token ID of the collectible (required)
- `newTycPrice` (string): New TYC price (wei) or 0 (required if no newUsdcPrice)
- `newUsdcPrice` (string): New USDC price (wei) or 0 (required if no newTycPrice)

**Example:**
```bash
curl -X POST http://localhost:3001/api/shop-admin/update-perk-prices \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": 2000000000,
    "newTycPrice": "1500000000000000000",
    "newUsdcPrice": "0"
  }'
```

---

### 4. Create a Bundle

**POST** `/stock-bundle`

Create a new bundle of multiple perks sold together.

**Request:**
```json
{
  "tokenIds": [2000000000, 2000000001, 2000000002],
  "amounts": [1, 1, 1],
  "tycPrice": "5000000000000000000",
  "usdcPrice": "12500000"
}
```

**Parameters:**
- `tokenIds` (array of numbers): Token IDs to include in bundle (required, length > 0)
- `amounts` (array of numbers): How many of each token (required, must match tokenIds length)
- `tycPrice` (string): Bundle price in TYC (wei) or 0 (required if no usdcPrice)
- `usdcPrice` (string): Bundle price in USDC (wei) or 0 (required if no tycPrice)

**Example - Create bundle of 3 perks for 5 TYC:**
```bash
curl -X POST http://localhost:3001/api/shop-admin/stock-bundle \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIds": [2000000000, 2000000001, 2000000002],
    "amounts": [1, 1, 1],
    "tycPrice": "5000000000000000000",
    "usdcPrice": "0"
  }'
```

**Response:** Returns the newly created bundleId in logs/events.

---

### 5. Activate/Deactivate a Bundle

**POST** `/bundle-active`

Enable or disable a bundle from being purchasable.

**Request:**
```json
{
  "bundleId": 1,
  "active": true
}
```

**Parameters:**
- `bundleId` (number): Bundle ID (required)
- `active` (boolean): true to enable, false to disable (required)

**Example - Deactivate bundle 1:**
```bash
curl -X POST http://localhost:3001/api/shop-admin/bundle-active \
  -H "Content-Type: application/json" \
  -d '{
    "bundleId": 1,
    "active": false
  }'
```

---

## Testing

### 1. Stock a new Extra Turn perk
```bash
curl -X POST http://localhost:3001/api/shop-admin/stock-perk \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "perk": 1,
    "strength": 1,
    "tycPrice": "1000000000000000000",
    "usdcPrice": "2500000"
  }'
```

### 2. Create a bundle with multiple perks
```bash
curl -X POST http://localhost:3001/api/shop-admin/stock-bundle \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIds": [2000000000, 2000000001],
    "amounts": [1, 1],
    "tycPrice": "2500000000000000000",
    "usdcPrice": "6000000"
  }'
```

### 3. Activate the bundle
```bash
curl -X POST http://localhost:3001/api/shop-admin/bundle-active \
  -H "Content-Type: application/json" \
  -d '{
    "bundleId": 1,
    "active": true
  }'
```

---

## Price Conversions

**TYC Token (18 decimals):**
- 1 TYC = `1000000000000000000` wei
- 0.1 TYC = `100000000000000000` wei
- 0.01 TYC = `10000000000000000` wei

**USDC Token (6 decimals):**
- 1 USDC = `1000000` wei
- 0.01 USDC = `10000` wei
- $2.50 USDC = `2500000` wei

---

## Security Notes

1. These endpoints currently have **no authentication**. You should add:
   - API key validation
   - Admin role check
   - Rate limiting
   - IP whitelisting

2. All transactions use `BACKEND_GAME_CONTROLLER_PRIVATE_KEY` from `.env`

3. Example middleware to add:
   ```javascript
   // Add to routes/shop-admin.js
   const requireAdminKey = (req, res, next) => {
     const key = req.headers['x-admin-key'];
     if (key !== process.env.SHOP_ADMIN_KEY) {
       return res.status(401).json({ error: 'Unauthorized' });
     }
     next();
   };

   router.post('/stock-perk', requireAdminKey, shopAdminController.stockPerk);
   // ... apply to all endpoints
   ```

---

## Error Handling

All endpoints return `{ success: false, error: "message" }` on failure with HTTP 4xx/5xx status.

**Common errors:**
- `REWARD_CONTRACT_ADDRESS not set in .env` - Update backend .env with contract address
- `BACKEND_GAME_CONTROLLER_PRIVATE_KEY not set` - Private key missing from .env
- `amount must be > 0` - Check input validation
- `Gas estimation failed` - Insufficient permissions or contract issue
