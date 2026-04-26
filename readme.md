# ⚔ WARROOM — Multi-Agent Strategic Debate Arena

> Tell it anything. Three AI agents debate it. A judge gives you a verdict.

WarRoom is a full-stack AI application where multiple specialised agents argue for and against any topic — whether it's a world policy question or a personal life decision like *"Should I buy a dog?"*

![WarRoom Banner](https://placehold.co/1200x400/080d14/f5a623?text=WARROOM+%E2%80%94+Multi-Agent+Debate+Arena&font=monospace)

---

## What it does

You type any topic. Four AI agents take over:

| Agent | Role |
|---|---|
| **AXIOM** (Proponent) | Argues as strongly as possible *for* your topic |
| **REFUTE** (Opponent) | Finds every weakness and argues *against* |
| **VERITAS** (Fact-Checker) | Neutral auditor — searches the web, detects logical fallacies, penalises fake stats |
| **ARBITER** (Judge) | Scores every turn, tracks consensus, delivers a final verdict with a recommendation |

Works for **any topic**:
- 🐕 "Should I buy a dog?"
- 💼 "Should I quit my job and freelance?"
- 🏠 "Should I rent or buy a house right now?"
- ⚡ "Nuclear energy is essential for net-zero"
- 🤖 "AI development should be paused immediately"

---

## Tech Stack

**Frontend**
- Next.js 14 (App Router) + TypeScript
- Pure CSS custom properties — no Tailwind
- Real-time WebSocket streaming
- Supabase Auth (signup / login)

**Backend**
- FastAPI + Python
- LangGraph state machine (the debate engine)
- Groq API (ultra-fast LLM inference — Llama 3.3 70B)
- Supabase (PostgreSQL database + Auth)
- Redis (pause/interrupt/approval state)
- Tavily (live web search for agents)

---

## Project Structure

```
WarRoom/
├── frontend/                  # Next.js app
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── NavBar.tsx         # Client nav with auth state
│   │   ├── auth/
│   │   │   ├── login/         # Login page
│   │   │   └── signup/        # Signup page
│   │   ├── debate/
│   │   │   ├── new/           # Create debate form
│   │   │   └── [id]/          # Live debate arena
│   │   └── history/           # Your past debates
│   ├── components/
│   │   ├── agents/            # AgentCard, AgentConfig
│   │   ├── approval/          # ApprovalGate (HITL tool approval)
│   │   ├── dashboard/         # ConsensusGauge, ScoringPanel, FallacyAlert, LiveMetrics
│   │   ├── debate/            # DebateFeed, InterruptModal, TurnDetail, JudgeVerdict, DebateControls
│   │   ├── graph/             # GraphCanvas, AgentNode, ToolEdge (React Flow)
│   │   ├── timeline/          # DebateTimeline, ForkModal (time-travel)
│   │   └── ui/                # Button, Badge, Tooltip
│   ├── hooks/
│   │   ├── useAuth.ts         # Supabase session management
│   │   ├── useDebate.ts       # Debate state + WS events
│   │   ├── useWebSocket.ts    # WS connection with auto-reconnect
│   │   └── useCheckpoints.ts  # Time-travel / fork
│   ├── lib/
│   │   ├── api.ts             # FastAPI client
│   │   ├── groq.ts            # Groq SDK wrapper
│   │   ├── supabase.ts        # Supabase client
│   │   └── types.ts           # All TypeScript interfaces
│   └── store/
│       └── debateStore.ts     # Zustand global state
│
└── backend/                   # FastAPI app
    ├── main.py                # Entry point
    ├── models/
    │   └── schemas.py         # All Pydantic models
    ├── routers/
    │   ├── debates.py         # REST endpoints
    │   └── ws.py              # WebSocket manager
    ├── agents/
    │   ├── graph.py           # LangGraph state machine
    │   ├── proponent.py       # Proponent agent
    │   ├── opponent.py        # Opponent agent
    │   ├── fact_checker.py    # Fact-checker agent
    │   ├── moderator.py       # Moderator + Judge verdict
    │   ├── consensus.py       # Vector embedding consensus engine
    │   ├── prompts.py         # All system prompts
    │   └── scoring.py         # Per-turn logic/evidence/fallacy scoring
    ├── services/
    │   ├── groq_client.py     # Groq API (lazy init)
    │   ├── supabase_client.py # DB operations
    │   └── redis_client.py    # Ephemeral state cache
    └── tools/
        ├── web_search.py      # Tavily live search
        └── python_repl.py     # Sandboxed Python executor
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- A [Supabase](https://supabase.com) project (free)
- A [Groq](https://console.groq.com) API key (free)
- A [Tavily](https://tavily.com) API key (free tier)

---

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/warroom.git
cd warroom
```

---

### 2. Set up the database

1. Go to your Supabase project → **SQL Editor** → **New query**
2. Paste the contents of `backend/supabase_schema.sql`
3. Click **Run**

---

### 3. Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> Get these from Supabase → Settings → API. Use the **anon/public** key, NOT the service_role key.

```bash
npm run dev
# Runs on http://localhost:3000
```

---

### 4. Backend setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
GROQ_API_KEY=gsk_your_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
REDIS_URL=redis://localhost:6379
TAVILY_API_KEY=tvly-your-key-here
CORS_ORIGINS=http://localhost:3000
DEBUG=true
```

> For `SUPABASE_SERVICE_KEY` use the **service_role** key from Supabase → Settings → API.

```bash
uvicorn main:app --reload --port 8000
# Runs on http://localhost:8000
```

---

### 5. Verify everything works

- Frontend: http://localhost:3000 — you should see the WarRoom landing page
- Backend: http://localhost:8000/health — should return `{"status": "online"}`
- Create an account, start a debate, watch it run

---

## Key Features

### Real-time streaming
Every agent's response streams token-by-token via WebSocket. You see the agents thinking and speaking live.

### Human-in-the-loop
Pause any debate mid-turn. Inject new evidence, challenge a specific claim, or redirect the conversation entirely.

### Fact-checking with live web search
The Fact-Checker agent uses Tavily to search the web in real time, verifying or debunking claims as they're made.

### Logical fallacy detection
Every turn is automatically scanned for 10+ fallacy types (Ad Hominem, Straw Man, False Dichotomy, etc.). Fallacies trigger toast alerts and penalise the offending agent's score.

### Consensus engine
Vector embeddings measure how much the Proponent and Opponent's stances have converged. The debate ends when they reach the configured similarity threshold.

### Time-travel & forking
Every round is checkpointed. Jump back to any round and fork a new debate branch from that moment — optionally with a new topic.

### Judge verdict
At the end of every debate, the Judge delivers a full verdict: winner, key arguments, fallacy summary, and a concrete recommendation — especially useful for personal life decisions.

### Personal topic support
WarRoom detects personal decision topics and adjusts agent behaviour accordingly. Instead of abstract logic, agents discuss practical consequences, emotions, lifestyle, and real-world impact.

---

## Environment Variables Reference

| Variable | Where | What |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | frontend/.env.local | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | frontend/.env.local | Supabase anon/public key |
| `NEXT_PUBLIC_API_URL` | frontend/.env.local | Backend URL (default: http://localhost:8000) |
| `GROQ_API_KEY` | backend/.env | Groq API key |
| `SUPABASE_URL` | backend/.env | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | backend/.env | Supabase service_role key |
| `REDIS_URL` | backend/.env | Redis connection (optional — falls back to memory) |
| `TAVILY_API_KEY` | backend/.env | Tavily search (optional — web search disabled without it) |

---

## Groq Models Used

| Agent | Model | Why |
|---|---|---|
| Proponent | `llama-3.3-70b-versatile` | Best reasoning for arguments |
| Opponent | `llama-3.3-70b-versatile` | Best reasoning for counter-arguments |
| Fact-Checker | `llama-3.1-8b-instant` | Needs speed for real-time auditing |
| Judge/Moderator | `llama-3.3-70b-versatile` | Best for nuanced scoring and verdicts |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT — do whatever you want with it.

---

Built with ⚔ by [Your Name](https://github.com/YOUR_USERNAME)