import { NextRequest, NextResponse } from "next/server";

type LyricLine = {
  startTimeMs: number | null;
  text: string;
};

type LrcLibResponse = {
  id?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

function parseSyncedLyrics(value: string | null | undefined): LyricLine[] {
  if (!value) {
    return [];
  }

  return value.split("\n").reduce<LyricLine[]>((lines, line) => {
      const match = line.match(/^\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
      if (!match) {
        return lines;
      }

      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = match[3] ?? "0";
      const milliseconds = Number(fraction.padEnd(3, "0").slice(0, 3));

      const text = match[4].trim();
      if (!text) {
        return lines;
      }

      lines.push({
        startTimeMs: minutes * 60_000 + seconds * 1000 + milliseconds,
        text,
      });

      return lines;
    }, []);
}

function parsePlainLyrics(value: string | null | undefined): LyricLine[] {
  if (!value) {
    return [];
  }

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({
      startTimeMs: null,
      text,
    }));
}

export async function GET(request: NextRequest) {
  const trackName = request.nextUrl.searchParams.get("track_name");
  const artistName = request.nextUrl.searchParams.get("artist_name");
  const albumName = request.nextUrl.searchParams.get("album_name");
  const duration = request.nextUrl.searchParams.get("duration");

  if (!trackName || !artistName || !albumName || !duration) {
    return NextResponse.json(
      {
        synced: false,
        instrumental: false,
        lines: [],
        source: "lrclib",
        error: "Missing lyric lookup fields",
      },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    track_name: trackName,
    artist_name: artistName,
    album_name: albumName,
    duration,
  });

  const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
    headers: {
      "User-Agent": "spotify-now-playing/1.0 (local Next.js app)",
    },
    next: {
      revalidate: 60 * 60 * 24,
    },
  });

  if (response.status === 404) {
    return NextResponse.json({
      synced: false,
      instrumental: false,
      lines: [],
      source: "lrclib",
      error: "No lyrics found",
    });
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        synced: false,
        instrumental: false,
        lines: [],
        source: "lrclib",
        error: "Could not load lyrics",
      },
      { status: 502 },
    );
  }

  const lyrics = (await response.json()) as LrcLibResponse;
  const syncedLines = parseSyncedLyrics(lyrics.syncedLyrics);
  const plainLines = parsePlainLyrics(lyrics.plainLyrics);

  return NextResponse.json({
    synced: syncedLines.length > 0,
    instrumental: Boolean(lyrics.instrumental),
    lines: syncedLines.length > 0 ? syncedLines : plainLines,
    source: "lrclib",
    error: null,
  });
}
