"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import useSWR from "swr";
import Image from "next/image";
import { clamp, formatTime } from "@/lib/utils";

type ArtistSpotlight = {
  name: string | null;
  imageUrl: string | null;
  genres: string[];
  followers: number | null;
  popularity: number | null;
};

type ListeningHistoryTrack = {
  title: string | null;
  artist: string | null;
  albumImageUrl: string | null;
  songUrl: string | null;
  playedAt: string | null;
};

type NowPlayingResponse = {
  isPlaying: boolean;
  isFallback: boolean;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumImageUrl: string | null;
  artistImageUrl: string | null;
  songUrl: string | null;
  progressMs: number;
  durationMs: number;
  playedAt: string | null;
  artistSpotlight: ArtistSpotlight | null;
  recentTracks: ListeningHistoryTrack[];
};

type LyricLine = {
  startTimeMs: number | null;
  text: string;
};

type LyricsResponse = {
  synced: boolean;
  instrumental: boolean;
  lines: LyricLine[];
  source: string;
  error: string | null;
};

type SpotifyPlayerReadyEvent = {
  device_id: string;
};

type MoodPalette = {
  one: string;
  two: string;
  three: string;
};

const fetcher = async (url: string): Promise<NowPlayingResponse> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch now playing");
  }
  return res.json();
};

const lyricsFetcher = async (url: string): Promise<LyricsResponse> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch lyrics");
  }
  return res.json();
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor(diff / 1000));

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatFollowers(value: number | null): string {
  if (value === null) return "New";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function makeFallbackPalette(seed: string): MoodPalette {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return {
    one: `hsla(${hue}, 70%, 58%, 0.35)`,
    two: `hsla(${(hue + 92) % 360}, 70%, 54%, 0.26)`,
    three: `hsla(${(hue + 188) % 360}, 76%, 62%, 0.18)`,
  };
}

function colorFromAverage(r: number, g: number, b: number, alpha: number): string {
  const lift = 34;
  return `rgba(${Math.min(255, r + lift)}, ${Math.min(255, g + lift)}, ${Math.min(255, b + lift)}, ${alpha})`;
}

function Equalizer({ active }: { active: boolean }) {
  return (
    <div className="equalizer" aria-hidden="true">
      <span className={active ? "bar active" : "bar"} />
      <span className={active ? "bar active" : "bar"} />
      <span className={active ? "bar active" : "bar"} />
      <span className={active ? "bar active" : "bar"} />
    </div>
  );
}

export default function NowPlayingCard() {
  const { data, error, isLoading, mutate: refreshNowPlaying } = useSWR<NowPlayingResponse>(
    "/api/spotify/now-playing",
    fetcher,
    {
      refreshInterval: (latestData) => {
        if (!latestData) return 5_000;
        return latestData.isPlaying ? 1_000 : 10_000;
      },
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1_500,
      errorRetryInterval: 10_000,
    }
  );

  const lyricsKey = useMemo(() => {
    if (!data?.title || !data.artist || !data.album || !data.durationMs) {
      return null;
    }

    const params = new URLSearchParams({
      track_name: data.title,
      artist_name: data.artist,
      album_name: data.album,
      duration: String(Math.round(data.durationMs / 1000)),
    });

    return `/api/lyrics?${params.toString()}`;
  }, [data?.title, data?.artist, data?.album, data?.durationMs]);

  const { data: lyricsData, error: lyricsError, isLoading: lyricsLoading } =
    useSWR<LyricsResponse>(lyricsKey, lyricsFetcher, {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    });

  const [liveProgressMs, setLiveProgressMs] = useState(0);
  const [progressAnchor, setProgressAnchor] = useState<{
    progressMs: number;
    receivedAt: number;
  } | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [playbackDeviceId, setPlaybackDeviceId] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState("Browser player loading");
  const [moodPalette, setMoodPalette] = useState<MoodPalette>(() =>
    makeFallbackPalette("spotify")
  );

  const hasTrack = Boolean(data?.title);
  const isIdle = Boolean(data && !data.isPlaying);
  const backgroundImageUrl = data?.albumImageUrl ?? data?.artistImageUrl ?? null;
  const paletteSeed = `${data?.title ?? ""}${data?.artist ?? ""}`;

  useEffect(() => {
    if (!data) return;
    setLiveProgressMs(data.progressMs);
    setProgressAnchor({
      progressMs: data.progressMs,
      receivedAt: performance.now(),
    });
  }, [data?.progressMs, data?.title, data?.isPlaying, data]);

  useEffect(() => {
    if (!data?.isPlaying || !progressAnchor) return;

    let timerId = 0;

    const tick = () => {
      setLiveProgressMs(
        clamp(
          progressAnchor.progressMs + (performance.now() - progressAnchor.receivedAt),
          0,
          data.durationMs || progressAnchor.progressMs,
        ),
      );
      timerId = window.setTimeout(tick, 250);
    };

    tick();

    return () => window.clearTimeout(timerId);
  }, [data?.isPlaying, data?.durationMs, data?.title, progressAnchor]);

  useEffect(() => {
    const fallback = makeFallbackPalette(paletteSeed || "spotify");
    if (!backgroundImageUrl) {
      setMoodPalette(fallback);
      return;
    }

    let cancelled = false;
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.src = backgroundImageUrl;

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 18;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) return;

        context.drawImage(image, 0, 0, size, size);
        const pixels = context.getImageData(0, 0, size, size).data;
        let red = 0;
        let green = 0;
        let blue = 0;
        let count = 0;

        for (let index = 0; index < pixels.length; index += 16) {
          red += pixels[index];
          green += pixels[index + 1];
          blue += pixels[index + 2];
          count += 1;
        }

        if (!cancelled && count > 0) {
          const r = Math.round(red / count);
          const g = Math.round(green / count);
          const b = Math.round(blue / count);
          setMoodPalette({
            one: colorFromAverage(r, g, b, 0.4),
            two: colorFromAverage(b, r, g, 0.27),
            three: colorFromAverage(g, b, r, 0.2),
          });
        }
      } catch {
        if (!cancelled) setMoodPalette(fallback);
      }
    };

    image.onerror = () => {
      if (!cancelled) setMoodPalette(fallback);
    };

    return () => {
      cancelled = true;
    };
  }, [backgroundImageUrl, paletteSeed]);

  useEffect(() => {
    let mounted = true;
    let player: any = null;

    const setupPlayer = () => {
      const Spotify = (window as any).Spotify;
      if (!Spotify || (window as any).__votelessSpotifyPlayerReady) return;

      (window as any).__votelessSpotifyPlayerReady = true;
      player = new Spotify.Player({
        name: "voteless.xyz player",
        getOAuthToken: async (callback: (token: string) => void) => {
          const response = await fetch("/api/spotify/access-token", {
            cache: "no-store",
          });
          const data = await response.json();
          if (response.status === 403) {
            setPlaybackStatus("Browser playback is local only");
            return;
          }

          if (data?.accessToken) {
            callback(data.accessToken);
          }
        },
        volume: 0.7,
      });

      player.addListener("ready", ({ device_id }: SpotifyPlayerReadyEvent) => {
        if (!mounted) return;
        setPlaybackDeviceId(device_id);
        setPlaybackStatus("Browser player ready");
      });

      player.addListener("not_ready", () => {
        if (!mounted) return;
        setPlaybackDeviceId(null);
        setPlaybackStatus("Browser player disconnected");
      });

      player.addListener("authentication_error", () => {
        if (!mounted) return;
        setPlaybackStatus("Reconnect Spotify for browser playback");
      });

      player.addListener("account_error", () => {
        if (!mounted) return;
        setPlaybackStatus("Spotify Premium is needed for web playback");
      });

      player.connect();
    };

    if ((window as any).Spotify) {
      setupPlayer();
    } else {
      (window as any).onSpotifyWebPlaybackSDKReady = setupPlayer;
      if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      mounted = false;
    };
  }, []);

  async function playInBrowser() {
    if (!playbackDeviceId) {
      setPlaybackStatus("Browser player is still loading");
      return;
    }

    setPlaybackStatus("Moving playback here");
    const response = await fetch("/api/spotify/transfer-playback", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ deviceId: playbackDeviceId }),
    });

    if (!response.ok) {
      setPlaybackStatus(
        response.status === 403
          ? "Browser playback is local only"
          : "Reconnect Spotify, then try again",
      );
      return;
    }

    setPlaybackStatus("Playing in this tab");
  }

  async function refreshPlayback() {
    setPlaybackStatus("Syncing Spotify");
    await refreshNowPlaying();
    setProgressAnchor((anchor) =>
      anchor
        ? {
            ...anchor,
            receivedAt: performance.now(),
          }
        : anchor,
    );
    setPlaybackStatus(playbackDeviceId ? "Browser player ready" : "Browser player loading");
  }

  const progressPercent = useMemo(() => {
    if (!data?.durationMs) return 0;
    return clamp((liveProgressMs / data.durationMs) * 100, 0, 100);
  }, [liveProgressMs, data?.durationMs]);

  const activeLyricIndex = useMemo(() => {
    const lines = lyricsData?.lines ?? [];
    if (!lines.length || !lyricsData?.synced) {
      return 0;
    }

    let activeIndex = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const startTimeMs = lines[index].startTimeMs;
      if (typeof startTimeMs === "number" && startTimeMs <= liveProgressMs + 650) {
        activeIndex = index;
      }
    }
    return activeIndex;
  }, [liveProgressMs, lyricsData?.lines, lyricsData?.synced]);

  const visibleLyrics = useMemo(() => {
    const lines = lyricsData?.lines ?? [];
    if (!lines.length) {
      return [];
    }

    const start = Math.max(0, activeLyricIndex - 2);
    return lines.slice(start, start + 6).map((line, offset) => ({
      ...line,
      index: start + offset,
    }));
  }, [activeLyricIndex, lyricsData?.lines]);

  const moodStyle = {
    "--mood-one": moodPalette.one,
    "--mood-two": moodPalette.two,
    "--mood-three": moodPalette.three,
  } as CSSProperties;

  if (isLoading) {
    return (
      <div className="player-stage" style={moodStyle}>
        <div className="player-shell">
          <div className="player-card">
            <div className="player-loading">Loading Spotify...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="player-stage" style={moodStyle}>
        <div className="player-shell">
          <div className="player-card">
            <div className="player-error">Couldn&apos;t load Spotify data.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={lyricsOpen ? "player-stage lyrics-open" : "player-stage"}
      style={moodStyle}
    >
      {backgroundImageUrl ? (
        <div className="stage-bg" aria-hidden="true">
          <img key={`stage-${backgroundImageUrl}`} src={backgroundImageUrl} alt="" />
        </div>
      ) : (
        <div className="stage-bg-fallback" aria-hidden="true" />
      )}

      <div className="player-column">
        <div className="player-shell">
          {backgroundImageUrl ? (
            <div className="player-bg">
              <img
                key={backgroundImageUrl}
                src={backgroundImageUrl}
                alt=""
                className="player-bg-image"
              />
              <div className="player-bg-overlay" />
            </div>
          ) : (
            <div className="player-bg-fallback" />
          )}

          <div className="player-card">
            <div className="player-topbar">
              <a href="/api/spotify/login" className="top-btn">
                Connect
              </a>

              <button
                className="top-status"
                type="button"
                onClick={() => setLyricsOpen((open) => !open)}
                aria-expanded={lyricsOpen}
              >
                <Equalizer active={Boolean(data.isPlaying)} />
                <span>{lyricsOpen ? "Player" : "Lyrics"}</span>
              </button>

              <div className="top-actions">
                <button
                  className="top-icon-btn"
                  type="button"
                  onClick={() => setSettingsOpen((open) => !open)}
                  aria-expanded={settingsOpen}
                  aria-label="Open settings"
                  title="Settings"
                >
                  &#9881;
                </button>
                <a href={data.songUrl ?? "#"} target="_blank" rel="noreferrer" className="top-btn">
                  Open
                </a>
              </div>
            </div>

            {!hasTrack ? (
              <div className="empty-state">
                <div className="idle-orbit">
                  <div className="idle-disc" />
                  <span className="idle-ring idle-ring-1" />
                  <span className="idle-ring idle-ring-2" />
                </div>
                <p className="eyebrow">Idle mode</p>
                <h2>Waiting for Spotify</h2>
                <p>Start a track and the room will light up with the cover, lyrics, and history.</p>
                <a className="idle-link" href="/api/spotify/login">
                  Connect Spotify
                </a>
              </div>
            ) : (
              <>
                {isIdle ? (
                  <div className="idle-banner">
                    <span className="idle-dot" />
                    <span>
                      Idle mode {data.playedAt ? ` / last played ${timeAgo(data.playedAt)}` : ""}
                    </span>
                  </div>
                ) : null}

                <div className={isIdle ? "art-wrap idle-art" : "art-wrap"}>
                  <div className={`vinyl ${data.isPlaying ? "spinning" : ""}`} />
                  <div className="album-ring">
                    {data.albumImageUrl ? (
                      <Image
                        src={data.albumImageUrl}
                        alt={`${data.album ?? data.title} cover`}
                        fill
                        priority
                        className="album-image"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="track-meta">
                  <p className="eyebrow">{data.isPlaying ? "Listening live" : "Recent track"}</p>
                  <h1>{data.title}</h1>
                  <h2>{data.artist}</h2>
                  <p className="album-name">{data.album}</p>
                </div>

                <div className="progress-wrap">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="progress-times">
                    <span>{formatTime(data.isFallback ? 0 : liveProgressMs)}</span>
                    <span>{formatTime(data.durationMs)}</span>
                  </div>
                </div>

                <div className="player-actions">
                  <button
                    className="icon-btn tooltip-btn"
                    type="button"
                    aria-label="Refresh Spotify"
                    data-tooltip="Syncing page"
                    onClick={refreshPlayback}
                  >
                    &#8635;
                  </button>

                  <button
                    className="play-btn tooltip-btn"
                    type="button"
                    onClick={playInBrowser}
                    aria-label="Play in browser"
                    data-tooltip="Play"
                    disabled={!playbackDeviceId}
                  >
                    &#9654;
                  </button>

                  <button
                    className="icon-btn tooltip-btn"
                    type="button"
                    aria-label="Show history"
                    data-tooltip="History"
                    onClick={() => setHistoryOpen((open) => !open)}
                    aria-expanded={historyOpen}
                  >
                    &#128214;
                  </button>
                </div>

                <div className="player-footer">
                  <div className="footer-pill">
                    {data.isPlaying ? "Live every 2s" : data.playedAt ? `Played ${timeAgo(data.playedAt)}` : "Waiting"}
                  </div>

                  <div className="footer-pill">
                    {data.isFallback ? "Fallback mode" : "Live sync"}
                  </div>

                  <div className="footer-pill">
                    {playbackStatus}
                  </div>
                </div>

                {data.artistSpotlight ? (
                  <section className="artist-spotlight">
                    {data.artistSpotlight.imageUrl ? (
                      <img src={data.artistSpotlight.imageUrl} alt="" className="artist-avatar" />
                    ) : null}
                    <div>
                      <p className="eyebrow">Artist spotlight</p>
                      <h3>{data.artistSpotlight.name ?? data.artist}</h3>
                      <p>
                        {data.artistSpotlight.genres.length
                          ? data.artistSpotlight.genres.join(" / ")
                          : "No genre tags yet"}
                      </p>
                      <div className="artist-stats">
                        <span>{formatFollowers(data.artistSpotlight.followers)} followers</span>
                        <span>{data.artistSpotlight.popularity ?? 0}% heat</span>
                      </div>
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </div>

        <section
          className={settingsOpen ? "settings-drawer settings-open" : "settings-drawer"}
          aria-hidden={!settingsOpen}
        >
          <div className="section-head">
            <p className="eyebrow">Settings</p>
            <button className="close-btn compact" type="button" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </div>

          <div className="settings-block">
            <h3>Coming soon</h3>
            <span>Reserved</span>
          </div>

          <p className="settings-note">This cog is ready for more controls later.</p>
        </section>

        <section
          className={historyOpen ? "history-drawer history-open" : "history-drawer"}
          aria-hidden={!historyOpen}
        >
          <div className="section-head">
            <p className="eyebrow">History</p>
            <button className="close-btn compact" type="button" onClick={() => setHistoryOpen(false)}>
              Close
            </button>
          </div>

          <div className="settings-block">
            <h3>Last 10 songs</h3>
            <span>{data.recentTracks.length || 0}</span>
          </div>

          {data.recentTracks.length ? (
            <div className="history-list">
              {data.recentTracks.map((track, index) => (
                <a
                  className="history-item"
                  href={track.songUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  key={`${track.playedAt ?? index}-${track.title ?? "track"}`}
                >
                  {track.albumImageUrl ? (
                    <img src={track.albumImageUrl} alt="" />
                  ) : (
                    <span className="history-fallback" />
                  )}
                  <span>
                    <strong>{track.title ?? "Unknown track"}</strong>
                    <small>{track.artist ?? "Unknown artist"} {track.playedAt ? ` / ${timeAgo(track.playedAt)}` : ""}</small>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="settings-note">Play a few tracks and they will land here.</p>
          )}
        </section>
      </div>

      <aside className="lyrics-panel" aria-hidden={!lyricsOpen}>
        <div className="lyrics-panel-inner">
          <div className="lyrics-head">
            <div>
              <p className="eyebrow">Lyrics</p>
              <h2>{data.title ?? "No track"}</h2>
              <p>{data.artist ?? "Waiting for Spotify"}</p>
            </div>
            <button className="close-btn" type="button" onClick={() => setLyricsOpen(false)}>
              Close
            </button>
          </div>

          <div className="lyrics-lines">
            {lyricsLoading ? (
              <div className="lyrics-state">
                <div className="lyrics-pulse" />
                <p className="lyric-line is-current">Finding synced lyrics...</p>
                <p className="lyric-line">Asking LRCLIB for a timed match.</p>
              </div>
            ) : lyricsError || lyricsData?.error ? (
              <div className="lyrics-state">
                <div className="lyrics-pulse muted" />
                <p className="lyric-line is-current">No synced lyrics found</p>
                <p className="lyric-line">LRCLIB did not have a match for this track.</p>
                <p className="lyric-line">Try another song and this panel will check again.</p>
              </div>
            ) : lyricsData?.instrumental ? (
              <div className="lyrics-state">
                <div className="lyrics-pulse" />
                <p className="lyric-line is-current">Instrumental track</p>
                <p className="lyric-line">No words needed for this one.</p>
              </div>
            ) : visibleLyrics.length ? (
              visibleLyrics.map((line) => (
                <p
                  className={line.index === activeLyricIndex ? "lyric-line is-current" : "lyric-line"}
                  key={`${line.startTimeMs ?? line.index}-${line.text}`}
                  style={{ "--lyric-offset": line.index - activeLyricIndex } as CSSProperties}
                >
                  {line.text}
                </p>
              ))
            ) : (
              <div className="lyrics-state">
                <div className="lyrics-pulse muted" />
                <p className="lyric-line is-current">No lyrics found</p>
                <p className="lyric-line">LRCLIB did not have a match for this track.</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
