import { NextResponse } from "next/server";
import { getNowPlayingOrLastPlayed } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getNowPlayingOrLastPlayed();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        isPlaying: false,
        isFallback: true,
        title: null,
        artist: null,
        album: null,
        albumImageUrl: null,
        artistImageUrl: null,
        songUrl: null,
        progressMs: 0,
        durationMs: 0,
        playedAt: null,
        artistSpotlight: null,
        recentTracks: [],
      },
      { status: 500 }
    );
  }
}
