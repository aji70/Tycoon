# Prompt: Scalability Analysis + Step-by-Step Improvements + Analytics Dashboards

**Use this with Claude or Cursor.** Copy the entire prompt below and paste it into a new chat. The AI should (1) analyze the repo, (2) give analytics and a plan, then (3) execute improvements one step at a time with testing in between, and (4) help build analytics dashboards for user feedback.

---

## Where the answers already live (we already ran this)

The questions in the prompt have **already been answered** in this repo. You don’t need to run the prompt again unless you want a fresh analysis or to do the optional follow-ups.

| Part | What it asks for | Where to find it in the repo |
|------|------------------|------------------------------|
| **Part 1: Analysis** | Scalability (100–200k DAUs), 200 concurrent players, frontend/backend standards | **`SCALABILITY_ANALYSIS.md`** (full report) and **`ANALYTICS_SUMMARY.md`** (sections 1–3) |
| **Part 2: Plan** | Analytics summary + prioritized improvement steps with tests | **`ANALYTICS_SUMMARY.md`** (section 4: execution plan) and **`LENA_CHECKLIST.md`** (steps 1–10) |
| **Part 3: Execution** | Step-by-step implementation with testing | **`LENA_CHECKLIST.md`** — steps 1–10 are done (pool, indexes, analytics backend, dashboard, Redis adapter, game-update, rate limits, cache, Pino, `/health`) |
| **Part 4: Dashboards** | Analytics dashboards for usage and user feedback | **Frontend:** `frontend/app/analytics/page.tsx` and `frontend/components/analytics/analytics-dashboard.tsx` (page at `/analytics`). **Backend:** `backend/services/analytics.js`, `backend/routes/analytics.js`, `GET /api/analytics/dashboard` |

**One-line status:** See the bottom of **`LENA_CHECKLIST.md`** (“One-line summary”).

Use the prompt below when you want to **re-run** the analysis, do the **optional follow-ups** (more events, N+1 fixes, load testing, dashboard protection), or have an AI work through the next steps interactively.

---

## Prompt (copy from here)

You are helping with the **Tycoon** project (a Web3 Monopoly-style game: Next.js frontend, Express backend, Socket.io, MySQL, Redis, blockchain integration). I need you to do the following in order.

### Part 1: Analysis

Analyze this codebase and produce a written report that answers:

1. **Scalability for 100k–200k DAUs**  
   - Is the current architecture scalable to 100k or 200k daily active users?  
   - Identify bottlenecks (DB pool, indexes, Redis usage, polling, rate limits, etc.) and rate current readiness (e.g. % or “ready / not ready”).  
   - List concrete changes needed to get to that scale.

2. **Concurrent play (e.g. 200 people playing at the same time)**  
   - What breaks or degrades when ~200 users are in active games at once?  
   - Consider: Socket.io scaling (single instance vs Redis adapter), DB locking and contention, connection limits, N+1 queries, event rate limits.  
   - List what must be added or changed to support 200+ concurrent players safely.

3. **Frontend and backend standards**  
   - Is the frontend using industry-standard libraries and patterns (e.g. React/Next.js, data fetching, state, real-time, styling, TypeScript)?  
   - Is the backend using standard practices (Express, DB access, validation, logging, security)?  
   - Note any gaps or non-standard choices.

Reference existing docs if present: `ANALYTICS_SUMMARY.md`, `LENA_CHECKLIST.md`, `SCALABILITY_ANALYSIS.md`.

### Part 2: Analytics and improvement plan

- Summarize what analytics and instrumentation already exist (events, tables, dashboards).  
- Propose a **prioritized list of improvements** (backend, frontend, infra) that would address the analysis.  
- For each improvement, define: **one clear step**, **how to test it**, and **what “done” looks like**.  
- Do **not** apply code changes yet — only output the plan.

### Part 3: Execute improvements step by step

- Start with **Step 1** from the plan.  
- Implement only that step (or one logical sub-step).  
- Tell me exactly what to run to test it (e.g. `npm run dev`, `curl /health`, run a game flow).  
- Wait for my confirmation that tests passed before proceeding to the next step.  
- Repeat until we have gone through the agreed steps or I ask to stop.

### Part 4: Analytics dashboards for user feedback

- Help design or extend analytics so we can:  
  - See usage (e.g. games created, started, finished, drop-off).  
  - Correlate with user feedback (e.g. events that might explain complaints).  
- Propose or implement dashboard changes (e.g. on `/analytics` or a new page) that show:  
  - Key metrics (counts, trends over time).  
  - Anything that would help debug issues or respond to user feedback.  
- Again, do dashboard work in small steps and suggest how to test each change.

**Rules:**  
- One step at a time; no big bang changes.  
- Every step must have a clear test before moving on.  
- If something is unclear or risky, ask before changing production paths.

---

## End of prompt

After you run this, you can refer back to `LENA_CHECKLIST.md` and `ANALYTICS_SUMMARY.md` to track what’s done and what’s next.
