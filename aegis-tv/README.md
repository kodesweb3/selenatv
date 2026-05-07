# ═══════════════════════════════════════════════════════════
#  A E G I S   T V
#  Private Premium IPTV Operating System
#  Personal Use Only
# ═══════════════════════════════════════════════════════════

## Overview

AegisTV is a **private, ultra-premium IPTV operating system** designed for personal use on **LG Smart TVs (webOS)**. It provides a luxury cinematic interface for aggregating and viewing free Romanian TV streams.

**This is NOT a public IPTV service. This is NOT for redistribution.**

---

## Architecture

```
LG Smart TV (webOS)
       │
       ▼
AegisTV Frontend App (Vanilla JS)
       │
       ▼
Private Node.js Backend
       │
       ├── Romanian IPTV Aggregator
       ├── Stream Validator
       ├── Auto Recovery Engine
       ├── EPG Processor
       ├── Channel Ranking System
       ├── Smart Cache
       └── JSON API
```

---

## Quick Start

### 1. Install Backend Dependencies

```bash
cd aegis-tv/backend
npm install
```

### 2. Configure Backend

Edit `backend/.env`:

```env
PORT=3000
HOST=0.0.0.0
CACHE_REFRESH_INTERVAL=30
STREAM_TIMEOUT=8000
```

### 3. Start Backend

```bash
cd backend
npm start
```

The backend will:
- Load any cached data for instant readiness
- Run initial IPTV scan if no cache exists
- Start automated refresh scheduler
- Serve JSON API on port 3000

### 4. Configure Frontend

Edit `webos-app/js/api.js` and set `BASE_URL` to your backend server IP:

```javascript
let BASE_URL = 'http://YOUR_SERVER_IP:3000';
```

### 5. Preview in Browser (Development)

```bash
cd aegis-tv
node dev-server.js
```

Then open `http://localhost:8080` in your browser.

### 6. Deploy to LG TV

See [webOS Deployment Guide](webos-deployment.md).

---

## Project Structure

```
aegis-tv/
│
├── backend/
│   ├── src/
│   │   ├── api/routes.js          # REST API endpoints
│   │   ├── scanner/iptvScanner.js  # IPTV source discovery
│   │   ├── parser/m3uParser.js     # M3U playlist parser
│   │   ├── validator/streamValidator.js  # Stream health checker
│   │   ├── epg/epgProcessor.js     # EPG XML parser
│   │   ├── cache/cacheManager.js   # JSON cache manager
│   │   ├── ranking/channelRanker.js # Channel scoring & dedup
│   │   ├── scheduler/scheduler.js  # Cron job orchestrator
│   │   └── utils/
│   │       ├── logger.js           # Colored logging
│   │       └── helpers.js          # Utility functions
│   │
│   ├── storage/                    # Generated data
│   │   ├── cache/                  # channels.json, etc.
│   │   ├── epg/                    # EPG data
│   │   └── logs/                   # Scan logs
│   │
│   ├── server.js                   # Express server entry
│   ├── package.json
│   └── .env
│
├── webos-app/
│   ├── css/
│   │   ├── main.css               # Core design system
│   │   ├── player.css             # Video player styles
│   │   └── animations.css         # CSS transitions
│   │
│   ├── js/
│   │   ├── app.js                 # Boot orchestrator
│   │   ├── api.js                 # Backend API client
│   │   ├── cache.js               # localStorage cache
│   │   ├── remote.js              # LG remote handler
│   │   ├── navigation.js          # Spatial navigation
│   │   ├── player.js              # HLS.js video player
│   │   └── ui.js                  # DOM renderer
│   │
│   ├── index.html                 # Main entry point
│   ├── appinfo.json               # webOS manifest
│   └── icon.svg                   # App icon
│
├── docs/                          # Documentation
├── dev-server.js                  # Browser preview server
└── README.md
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/channels` | All channels (optional `?category=`) |
| `GET /api/channels/:id` | Single channel details |
| `GET /api/categories` | Category list with counts |
| `GET /api/featured` | Featured/promoted channels |
| `GET /api/epg` | EPG data (optional `?channel=`) |
| `GET /api/search?q=` | Search channels |
| `GET /api/status` | System health & stats |
| `POST /api/admin/recategorize` | Re-clasifică canalele din cache după nume (fără scan IPTV). Dacă `SELENA_ADMIN_KEY` e setat, trimite header `X-Selena-Admin: <cheie>` |

**Recategorizare din cache** (exemplu):

```bash
curl -X POST https://BACKEND_URL/api/admin/recategorize -H "X-Selena-Admin: CHEIA_TA"
```

(exclude header-ul dacă nu există `SELENA_ADMIN_KEY` în `.env`)

---

## Remote Control

| Button | Action |
|--------|--------|
| ↑ ↓ | Navigate rows |
| ← → | Navigate cards |
| OK | Select / Play |
| BACK | Stop player / Go back |
| CH+/CH- | Switch channels in player |
| INFO | Toggle player overlay |
| YELLOW | Toggle favorite |

---

## Design

- **Palette**: Matte black (#050505), obsidian surfaces, gold accents (#C6A972)
- **Typography**: Inter (Google Fonts)
- **Style**: Netflix + Bloomberg + Apple TV aesthetics
- **No frameworks**: Pure vanilla JS/CSS for TV performance

---

## Performance Targets

- ✅ Under 2 second startup (cache-first architecture)
- ✅ Under 1 second channel switch (HLS.js optimized)
- ✅ 60fps navigation (CSS transitions only)
- ✅ Minimal DOM (no virtual DOM overhead)
- ✅ Small bundle (no React/Vue/Angular)

---

## License

**Private use only. Not for redistribution.**
