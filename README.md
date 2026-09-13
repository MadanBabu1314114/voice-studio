# Voice Studio React — AI Text to Audio (batch)

Batch Telugu TTS with Fish S2.1 via OpenRouter. Multiple voices + multiple texts → multiple MP3s at once.

- Auth: Firebase email/password. Profile/texts/voice-refs/history in Realtime Database (`ai-text-to-audio-ebe97`).
- TTS: `fish-audio/s2.1-pro-free:free`, key in browser `localStorage` only.
- UI: glassmorphism, dark/light, fully responsive (1→2→3 col, sticky batch bar, 44px targets).
- Deploy: GitHub Actions → Pages. Run: Docker or npm (see `COMMANDS.txt`).

## Quick start
```bash
cd voice-studio-react
npm install
npm run dev
```

## Files & risk
| File | Risk |
|---|---|
| `src/lib/firebase.ts` (env only) | High — committed keys = abuse; use Secrets |
| `database.rules.json` | High — open rules leak texts |
| `src/lib/openrouter.ts` | High — 503/CORS needs Fish-direct fallback |
| `src/lib/queue.ts` | Med — cap concurrency, revoke blob URLs |
| `src/pages/Studio.tsx` | Med — RTDB write storm; history capped 50 |
| `.github/workflows/deploy.yml` | Med — needs Pages Source = Actions |
| `Dockerfile`, `docker-compose.yml` | Low — VITE_* baked at build |
| `COMMANDS.txt` | Low — keep ports in sync |
