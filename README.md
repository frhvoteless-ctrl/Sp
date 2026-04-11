# Spotify Now Playing

A modern Next.js App Router site that shows your current Spotify track, with a last-played fallback and built-in Spotify auth.

## Features

- Live now playing card
- Last played fallback
- Blurred album art background
- One-click Spotify auth button in the UI
- Auto-save refresh token to `.env.local` during local development
- Manual fallback display if auto-save is unavailable

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env.local
```

3. Fill in:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`

4. Add this redirect URI in your Spotify app dashboard:

```txt
http://127.0.0.1:3000/api/spotify/callback
```

5. Start the app:

```bash
npm run dev
```

6. Open the site homepage and click **One-click Spotify auth**.

7. After approval, the callback route will try to save your refresh token directly into `.env.local`.

8. Restart the dev server after auth so Next.js reloads the env file.

## Notes

- Auto-save works for local dev where the route can write to your project folder.
- On some hosted platforms, filesystem writes are not persistent, so the app falls back to showing the token for manual copy.
