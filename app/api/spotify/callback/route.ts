import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { exchangeCodeForTokens } from "@/lib/spotify";

export const runtime = "nodejs";

function isProductionHost() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

async function saveRefreshTokenToEnv(refreshToken: string) {
  const envPath = path.join(process.cwd(), ".env.local");

  let current = "";
  try {
    current = await fs.readFile(envPath, "utf8");
  } catch {
    current = "";
  }

  const line = `SPOTIFY_REFRESH_TOKEN=${refreshToken}`;
  let next = current;

  if (/^SPOTIFY_REFRESH_TOKEN=.*/m.test(next)) {
    next = next.replace(/^SPOTIFY_REFRESH_TOKEN=.*/m, line);
  } else {
    next = next.trimEnd();
    next = next ? `${next}\n${line}\n` : `${line}\n`;
  }

  await fs.writeFile(envPath, next, "utf8");
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent("Missing code")}`, request.url),
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const refreshToken = tokens.refresh_token ?? "";

    if (!refreshToken) {
      return NextResponse.redirect(
        new URL(`/auth?error=${encodeURIComponent("Spotify did not return a refresh token")}`, request.url),
      );
    }

    try {
      await saveRefreshTokenToEnv(refreshToken);

      return NextResponse.redirect(
        new URL(`/auth?saved=1`, request.url),
      );
    } catch (saveError: any) {
      if (isProductionHost()) {
        return NextResponse.redirect(
          new URL(
            `/auth?warning=${encodeURIComponent(
              "Refresh token received. Add it to SPOTIFY_REFRESH_TOKEN in your host environment variables.",
            )}`,
            request.url,
          ),
        );
      }

      return NextResponse.redirect(
        new URL(
          `/auth?warning=${encodeURIComponent(
            saveError?.message ?? "Could not auto-save token. Check .env.local permissions, then connect again.",
          )}`,
          request.url,
        ),
      );
    }
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(err?.message ?? "Token exchange failed")}`, request.url),
    );
  }
}
