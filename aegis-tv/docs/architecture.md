# AegisTV — System Architecture

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SCHEDULED PIPELINE                        │
│                  (every 30 minutes)                          │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐ │
│  │  SCANNER  │──▶│  PARSER  │──▶│ VALIDATOR │──▶│ RANKER │ │
│  │          │    │          │    │          │    │        │ │
│  │ Fetches  │    │ Extracts │    │ Tests    │    │ Scores │ │
│  │ M3U URLs │    │ channels │    │ streams  │    │ & dedup│ │
│  └──────────┘    └──────────┘    └──────────┘    └───┬────┘ │
│                                                      │      │
│                                              ┌───────▼────┐ │
│                                              │   CACHE    │ │
│                                              │            │ │
│                                              │ channels   │ │
│                                              │ categories │ │
│                                              │ featured   │ │
│                                              └───────┬────┘ │
└──────────────────────────────────────────────────────┼──────┘
                                                       │
                                                       ▼
                                              ┌──────────────┐
                                              │  EXPRESS API  │
                                              │              │
                                              │ /api/channels│
                                              │ /api/epg     │
                                              │ /api/search  │
                                              └──────┬───────┘
                                                     │
                                            HTTP JSON │
                                                     │
                                              ┌──────▼───────┐
                                              │  WEBOS APP   │
                                              │              │
                                              │ localStorage │
                                              │ HLS.js       │
                                              │ Remote Nav   │
                                              └──────────────┘
```

## Channel Scoring Formula

```
Overall Score = (Latency × 0.3) + (Quality × 0.4) + (Stability × 0.3)

Where:
  Latency Score  = max(0, 100 - (latency_ms / 50))
  Quality Score  = based on resolution detection (1080p=100, 720p=80, etc.)
  Stability Score = base 80, adjusted over time by uptime tracking
```

## Cache Strategy

| Layer | Storage | TTL | Purpose |
|-------|---------|-----|---------|
| Backend disk | JSON files | Until next scan | Source of truth |
| Backend memory | JS objects | Runtime | Hot data for API |
| Frontend localStorage | JSON strings | 30 min | Offline-first startup |
| Frontend favorites | localStorage | ∞ | User preferences |
| Frontend recent | localStorage | ∞ | Watch history |

## Startup Sequence

```
1. Show splash screen (instant, no data needed)
2. Load localStorage cache (< 5ms)
3. Render UI from cache (< 50ms)
4. Fetch fresh data from backend (async, background)
5. Update UI if new data received
6. Start 5-minute background refresh cycle
```

This ensures **under 2 second perceived startup** even on cold boot.
