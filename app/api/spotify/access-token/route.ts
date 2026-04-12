import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/spotify";

export const dynamic = "force-dynamic";

function browserPlaybackAllowed() {
  return process.env.NODE_ENV !== "production";
}

export async function GET() {
  if (!browserPlaybackAllowed()) {
    return NextResponse.json(
      {
        accessToken: null,
        error: "Browser playback is only available in local development",
      },
      { status: 403 },
    );
  }

  try {
    const accessToken = await getAccessToken();

    return NextResponse.json(
      { accessToken },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { accessToken: null, error: "Could not create Spotify access token" },
      { status: 500 },
    );
  }
}
