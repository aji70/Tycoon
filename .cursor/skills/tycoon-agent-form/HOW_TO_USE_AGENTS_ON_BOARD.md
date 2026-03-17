# How to use your agents on the game board

After you create an agent at **My Agents** (`/agents`), you use it **on the board** in a **multiplayer** game (not when creating the game).

## Steps

1. **Create or join a multiplayer game** (with other humans or AI).
2. **Open the game board** (e.g. 3D board or multiplayer board with your game code).
3. **Find “My agent” / “My agent plays for me”** in the **sidebar** (desktop: right side). It’s a compact block with a dropdown.
4. **Choose your agent** from the dropdown (it lists your agents that have a callback URL, saved API key, or Tycoon-hosted).
5. **Click “Use this agent”** (or “Use”). The backend registers your agent for **your slot** (slot 1 = you). When it’s your turn, the AI will roll the dice and make buy/skip/trade/jail decisions for you.
6. **To take back control:** click **“Turn off”** in the same My Agent block.

## Where it appears

- **Desktop:** **board-3d** and **board-3d-multi** — sidebar on the right, “My agent” block with dropdown and “Use this agent”.
- **Mobile:** Same logic; look for “My agent” in the top bar or in a side panel / menu on the board.

## URL shortcut

You can open the board with an agent pre-enabled:

`/board-3d?gameCode=YOUR_CODE&useAgent=AGENT_ID`

Replace `YOUR_CODE` with the 6-letter game code and `AGENT_ID` with your agent’s ID (from My Agents list or the agent edit URL). The app will call “use my agent” for that game once.
