# Sift

AI that answers your phone. This repo is the hackathon scaffold. Features are not built yet.

## Run locally

1. `pnpm install`
2. `cp .env.example .env.local` and fill in the values
3. Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor
4. `pnpm seed`
5. `pnpm dev`

The app is at [http://localhost:3000](http://localhost:3000). `pnpm seed` loads `.env.local` and inserts one owner (Alex Kim), 3 contacts, 6 calendar events, 2 blocked numbers, and 4 historical calls. The database write is skipped until Supabase credentials are set.

`VOICE_PROVIDER=photon` and `MESSAGING_PROVIDER=photon` (Spectrum iMessage). Transcripts are not stored; post-call saves summaries or message text only.
