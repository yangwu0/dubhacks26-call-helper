# Sift

AI that answers your phone. This repo is the hackathon scaffold. Features are not built yet.

## Run locally

1. `pnpm install`
2. Copy env into `.env` and fill in the values
3. Wipe `public` if needed, then run `supabase/migrations/0001_init.sql` in the Supabase SQL editor
4. `pnpm dev`

The app is at [http://localhost:3000](http://localhost:3000). Sign in on `/` to create an Auth user and linked `owners` row.

`VOICE_PROVIDER=photon` (SIP voice via Photon). Messaging (iMessage/SMS alerts and reply commands) is disabled for now; post-call summaries are stored on the call for the dashboard.
