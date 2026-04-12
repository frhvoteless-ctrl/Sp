import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/spotify";

export const dynamic = "force-dynamic";

function browserPlaybackAllowed() {
  return process.env.NODE_ENV !== "production";
}

export async function PUT(request: NextRequest) {
  if (!browserPlaybackAllowed()) {
    return NextResponse.json(
      { error: "Browser playback is only available in local development" },
      { status: 403 },
    );
  }

  try {
    const { deviceId } = (await request.json()) as { deviceId?: string };
    if (!deviceId) {
      return NextResponse.json({ error: "Missing device ID" }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    const response = await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_ids: [deviceId],
        play: true,
      }),
      cache: "no-store",
    });

    if (!response.ok && response.status !== 204) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Could not transfer playback: ${response.status} ${text}` },
        { status: response.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not transfer Spotify playback" },
      { status: 500 },
    );
  }
}
