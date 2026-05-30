# AI Pipeline Arena — Multiplayer Bidding & Auction System

This repository hosts the stateful multiplayer **Bidding & Auction System** coupled with the visual **9x9 grid sandbox builder** for **AI Pipeline Arena**. 

The codebase is organized as a clean **Monorepo** designed to be pushed as a private repository to GitHub, allowing seamless stateful server deployment on **Railway** and stateless frontend clients on **Vercel**.

---

## 📁 Repository Structure

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

## ⚡ Local Development Quick Start

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

## 🔑 Environment Variables Setup

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

## 🚀 Cloud Deployment Roadmap

### A. Railway (Backend Deployment)
1. Link your private GitHub repository `bidding-auction-system` in Railway.
2. In the setup wizard, set the **Root Directory** as **`backend`**.
3. Add your `MONGO_URI` secret in the **Variables** tab.
4. Railway will automatically detect the node server and deploy. Generate a **Public Domain URL** inside your Railway service settings.

### B. Vercel (Clients Deployment)
1. Add a new project in Vercel and link your `bidding-auction-system` repository.
2. Under **Root Directory**, select **`player-client`**. Add `VITE_BACKEND_URL` in environment variables pointing to your Railway backend domain. Click **Deploy**.
3. Add another project in Vercel. Select **`admin-client`** as the **Root Directory**. Add `VITE_BACKEND_URL` in environment variables. Click **Deploy**.
