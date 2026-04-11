import { NextResponse } from "next/server";
import { getSpotifyLoginUrl } from "@/lib/spotify";

export async function GET() {
  return NextResponse.redirect(getSpotifyLoginUrl());
}
