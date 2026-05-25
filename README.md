# AI Site Factory

Autonomous AI-powered website generation platform.  
One click → AI invents an idea → writes code → pushes to GitHub → deploys live on Vercel.

---

## Project Structure

```
project-root/
├── frontend/
│   ├── index.html          ← Main hub (permanent homepage)
│   ├── dashboard.html      ← Gallery, filter, preview, stats
│   ├── styles/
│   │   └── globals.css     ← Shared design system
│   └── generated/
│       ├── sites.json      ← Metadata for all deployed sites
│       └── [site-name]/
│           └── index.html  ← Local copy of generated site
│
├── backend/
│   ├── generator.js        ← Main server + pipeline orchestrator
│   ├── deployer.js         ← GitHub API + Vercel API
│   ├── scheduler.js        ← Auto-generation cron job
│   ├── openrouter.js       ← AI client with model fallback
│   ├── routeBuilder.js     ← Route registry manager
│   ├── .env                ← API keys (never commit this)
│   └── package.json
│
├── critic/
│   ├── criticAgent.js      ← Orchestrates validate → score → repair
│   ├── validator.js        ← HTML/CSS/JS structure checks
│   ├── scorer.js           ← Quality scoring (0–100)
│   └── repairAgent.js      ← AI-powered auto-repair
│
└── README.md
```

---

## Quick Start

### 1. Install backend dependencies
```bash
cd backend
npm install
```

### 2. Configure API keys
Edit `backend/.env` — keys are already pre-filled.

### 3. Start the server
```bash
cd backend
node generator.js
```

### 4. Open the app
```
http://localhost:4000/index.html       ← Homepage
http://localhost:4000/dashboard.html  ← Dashboard
```

### 5. Auto-scheduler (optional)
```bash
cd backend
node scheduler.js
```
Generates a new site automatically every 6 hours (configurable in `.env`).

---

## How It Works

```
Click Generate
    │
    ▼
[1] OpenRouter AI (gpt-4o-mini)
    → Invents idea + writes complete index.html
    │
    ▼
[2] Critic Agent
    → Validates HTML structure, responsiveness, animations
    → Scores 0–100
    → Auto-repairs issues (up to 2 attempts)
    │
    ▼
[3] GitHub API
    → Creates new public repo
    → Pushes index.html + README.md
    │
    ▼
[4] Vercel API
    → Deploys directly (no GitHub connection needed)
    → Returns live URL
    │
    ▼
[5] Saved to sites.json + gallery
    → Card appears in dashboard instantly
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/generate` | Run full pipeline. Body: `{ "prompt": "..." }` |
| `GET`  | `/api/sites`    | List all generated sites |
| `GET`  | `/api/health`   | Server health check |

---

## Environment Variables

| Key | Description |
|-----|-------------|
| `OPENROUTER_KEY` | OpenRouter API key |
| `GITHUB_TOKEN` | GitHub classic token (repo scope required) |
| `GITHUB_USER` | GitHub username |
| `VERCEL_TOKEN` | Vercel personal token |
| `PORT` | Backend port (default: 4000) |
| `SCHEDULE_INTERVAL_HOURS` | Auto-generation interval (default: 6) |
| `FRONTEND_DIR` | Path to save generated HTML files |
| `METADATA_FILE` | Path to sites.json |
