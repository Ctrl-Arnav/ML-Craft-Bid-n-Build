# AI Pipeline Arena — Multiplayer Bidding & Auction System

This repository hosts the stateful multiplayer **Bidding & Auction System** coupled with the visual **9x9 grid sandbox builder** for **AI Pipeline Arena**. 

### How the Game Works

Players join a live room and are automatically sorted into balanced groups (pods). The game runs in **3 rounds**, each following a tight loop:

1. **Auction Phase** — A series of tool blocks (datasets, processors, models, optimizers, evaluators) are put up for auction one by one. Players compete in real-time bidding wars using a limited budget of *Emeralds*, with a 25-second countdown that resets on every new bid. Each group gets exactly `n - 1` items (where `n` is the group size), so at least one player walks away empty-handed every round.
2. **Builder Phase (6 min)** — Players drag their acquired tools from an inventory shelf onto a 9x9 grid canvas to construct a sequential 6-slot ML pipeline. A live scoring engine evaluates three metrics — **Accuracy**, **Time Efficiency**, and **Stability** — based on each block's hidden stat impacts, domain compatibility, and placement order.
3. **Cooldown & Scoring** — Pipelines are auto-locked, scores are converted into Emerald income for the next round's auction budget, and the leaderboard updates globally.

After all 3 rounds, each player receives a unique **cryptographic verification hash** derived from their name, enrollment ID, final score, and total time spent — serving as a tamper-proof proof-of-participation that can be submitted to an external portal.

### Minecraft Meets Machine Learning

Every tool in the game is skinned as a recognizable Minecraft item, but each one maps directly to a real stage of an ML pipeline. Players don't need prior ML knowledge — the game teaches the concepts through play:

| Minecraft Tool | ML Pipeline Role | What It Does In-Game |
|:---|:---|:---|
| **Cobblestone / Raw Iron / Gold Ore / Diamond Ore** | Training Dataset | Data inputs of increasing quality. Raw ores (noisy data) boost Accuracy potential but tank Stability unless cleaned first. Diamond Ore is high-dimensional and pristine but crushes Time Efficiency. |
| **Furnace / Blast Furnace** | Data Preprocessing | Cleans raw ore inputs. A standard Furnace removes noise at a small speed cost; the Blast Furnace normalizes features *and* boosts speed — like the difference between manual imputation and an automated `sklearn` pipeline. |
| **Axe / Pickaxe / Sword / Shovel Blueprints** | Domain-Specific Feature Extractor | Each blueprint is locked to a problem domain (Text, Vision, Anomaly, Time-Series). Matching the blueprint to the round's quest (e.g. Pickaxe for an Image Classification quest) triggers a massive Accuracy multiplier — mismatching it applies a penalty, just like using a CNN on tabular data. |
| **Crafting Table / Auto-Crafter** | Model Architecture | The Crafting Table is a safe, general-purpose model (think Logistic Regression). The Auto-Crafter is a powerful deep learner (think a fine-tuned neural net) that yields higher scores but costs more Emeralds. |
| **Redstone Compute Block** | GPU / Hardware Accelerator | A sidecar block that plugs into the Auto-Crafter to skyrocket Time Efficiency — simulating the effect of adding GPU compute to a training job. |
| **Anvil / Enchanting Bench** | Regularization & Hyperparameter Tuning | The Anvil stabilizes volatile models (L2 regularization); the Enchanting Bench applies aggressive tuning that spikes Accuracy but drains budget (grid-search on a massive param space). |
| **Wooden Chest / Ender Chest** | Validation / Evaluation Split | A small chest is a quick 80/20 holdout — fast but high-variance. The Ender Chest is a full k-fold cross-validation suite — slow but maximizes true Accuracy and Stability. |

The result: players intuitively learn that *a raw dataset needs cleaning before modeling*, *domain-specific feature extraction matters*, and *more compute isn't free* — all without reading a single textbook.

The codebase is organized as a clean **Monorepo** designed to be pushed as a private repository to GitHub, allowing seamless stateful server deployment on **Railway** and stateless frontend clients on **Vercel**.

<img width="1195" height="932" alt="WhatsApp Image 2026-09-20 at 2 14 34 PM" src="https://github.com/user-attachments/assets/c0b28048-1f48-4c56-9e6a-2c845decfdc6" />


<img width="1192" height="936" alt="image" src="https://github.com/user-attachments/assets/0a3e8131-84d4-4846-85c8-88fac9bb48d7" />


---

## Repository Structure

```text
bidding-auction-system/ (Root Repository -> Private on GitHub)
├── .gitignore                      # Excludes node_modules, builds, and local env files
├── README.md                       # Setup & Migration Guide
│
├── player-client/                  # React Vite Client for Players -> Deploys to Vercel
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                 // Central visual sandbox grid builder + Auction views switcher
│       ├── index.css
│       ├── components/             // Contains AuctionPanel.jsx
│       ├── data/                   // Contains tools.js catalog
│       └── utils/                  // Contains scoring.js client scorer preview
│
├── admin-client/                   // React Vite Client for Hosts -> Deploys to Vercel
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       └── components/             // Contains AdminPanel.jsx dashboard controllers
│
└── backend/                        // Node.js Stateful Socket.io Server -> Deploys to Railway
    ├── package.json
    ├── server.js                   // Real-time WebSocket ticker tick loop
    └── models/                     // MongoDB Atlas Mongoose Database Schemas
        ├── Player.js               // Tracks account budgets, items owned, grid coordinates
        ├── GameRoom.js             // Manages rounds progress queues
        └── Bid.js                  // Archives bid logs
```

---

## Local Development Quick Start

To run the complete system locally, follow these commands in three separate terminal instances:

### 1. Launch Stateful Backend Server
```bash
cd backend
npm install
# Set environment variables (or create a backend/.env file)
# MONGO_URI="mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/pipeline-arena"
npm start
```
The server will boot on `http://localhost:3001` and connect to your MongoDB cluster.

### 2. Launch Player Client
```bash
cd player-client
npm install
npm run dev
```
The player dashboard will boot on `http://localhost:5173`.

### 3. Launch Host Admin Client
```bash
cd admin-client
npm install
npm run dev
```
The lobby host dashboard will boot on `http://localhost:5174`.

---

## Environment Variables Setup

Configure these secrets in Vercel and Railway dashboard settings:

### A. Railway (Backend Server Configs)
| Variable Key | Suggested Value | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3001` (or auto assigned) | Express binding port |
| `MONGO_URI` | `mongodb+srv://...` | MongoDB Atlas cluster connection string |
| `NODE_ENV` | `production` | Optimizes engine build |

### B. Vercel (Frontend Configs)
In **both** Vercel projects (`player-client` and `admin-client`), set:
| Variable Key | Suggested Value | Purpose |
| :--- | :--- | :--- |
| `VITE_BACKEND_URL` | `https://bidding-backend-production.up.railway.app` | Points clients to the Railway live Socket.io server |

---

## Cloud Deployment Roadmap

### A. Railway (Backend Deployment)
1. Link your private GitHub repository `bidding-auction-system` in Railway.
2. In the setup wizard, set the **Root Directory** as **`backend`**.
3. Add your `MONGO_URI` secret in the **Variables** tab.
4. Railway will automatically detect the node server and deploy. Generate a **Public Domain URL** inside your Railway service settings.

### B. Vercel (Clients Deployment)
1. Add a new project in Vercel and link your `bidding-auction-system` repository.
2. Under **Root Directory**, select **`player-client`**. Add `VITE_BACKEND_URL` in environment variables pointing to your Railway backend domain. Click **Deploy**.
3. Add another project in Vercel. Select **`admin-client`** as the **Root Directory**. Add `VITE_BACKEND_URL` in environment variables. Click **Deploy**.
