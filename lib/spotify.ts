const SPOTIFY_TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SPOTIFY_NOW_PLAYING_ENDPOINT = "https://api.spotify.com/v1/me/player/currently-playing";
const SPOTIFY_RECENTLY_PLAYED_ENDPOINT = "https://api.spotify.com/v1/me/player/recently-played?limit=5";
const SPOTIFY_ARTIST_ENDPOINT = "https://api.spotify.com/v1/artists";
const SPOTIFY_AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";

export type SpotifyTrackArtist = {
  id?: string;
  name: string;
};

export type SpotifyArtistSpotlight = {
  name: string | null;
  imageUrl: string | null;
  genres: string[];
  followers: number | null;
  popularity: number | null;
};

export type ListeningHistoryTrack = {
  title: string | null;
  artist: string | null;
  albumImageUrl: string | null;
  songUrl: string | null;
  playedAt: string | null;
};

export type NowPlayingData = {
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
  artistSpotlight: SpotifyArtistSpotlight | null;
  recentTracks: ListeningHistoryTrack[];
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getBasicAuthHeader(): string {
  const clientId = requiredEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requiredEnv("SPOTIFY_CLIENT_SECRET");
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${encoded}`;
}

export function getSpotifyLoginUrl(): string {
  const clientId = requiredEnv("SPOTIFY_CLIENT_ID");
  const redirectUri = requiredEnv("SPOTIFY_REDIRECT_URI");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "user-read-currently-playing user-read-recently-played",
    show_dialog: "true",
  });

  return `${SPOTIFY_AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const redirectUri = requiredEnv("SPOTIFY_REDIRECT_URI");

  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to exchange code: ${response.status} ${text}`);
  }

  return response.json();
}

export async function getAccessToken(): Promise<string> {
  const refreshToken = requiredEnv("SPOTIFY_REFRESH_TOKEN");

  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

async function getArtistSpotlight(accessToken: string, artistId: string | null): Promise<SpotifyArtistSpotlight | null> {
  if (!artistId) {
    return null;
  }

  const response = await fetch(`${SPOTIFY_ARTIST_ENDPOINT}/${artistId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const artist = await response.json();
  return {
    name: artist?.name ?? null,
    imageUrl: artist?.images?.[0]?.url ?? null,
    genres: Array.isArray(artist?.genres) ? artist.genres.slice(0, 3) : [],
    followers: typeof artist?.followers?.total === "number" ? artist.followers.total : null,
    popularity: typeof artist?.popularity === "number" ? artist.popularity : null,
  };
}

function getArtistNames(track: any): string | null {
  return Array.isArray(track?.artists)
    ? track.artists.map((artist: SpotifyTrackArtist) => artist.name).join(", ")
    : null;
}

function getPrimaryArtistId(track: any): string | null {
  return Array.isArray(track?.artists) ? track.artists[0]?.id ?? null : null;
}

function mapHistoryTrack(item: any): ListeningHistoryTrack {
  const track = item?.track;

  return {
    title: track?.name ?? null,
    artist: getArtistNames(track),
    albumImageUrl: track?.album?.images?.[2]?.url ?? track?.album?.images?.[0]?.url ?? null,
    songUrl: track?.external_urls?.spotify ?? null,
    playedAt: item?.played_at ?? null,
  };
}

function mapTrackToData(
  track: any,
  isPlaying: boolean,
  isFallback: boolean,
  playedAt: string | null,
  artistSpotlight: SpotifyArtistSpotlight | null,
  recentTracks: ListeningHistoryTrack[],
): NowPlayingData {
  return {
    isPlaying,
    isFallback,
    title: track?.name ?? null,
    artist: getArtistNames(track),
    album: track?.album?.name ?? null,
    albumImageUrl: track?.album?.images?.[0]?.url ?? null,
    artistImageUrl: artistSpotlight?.imageUrl ?? null,
    songUrl: track?.external_urls?.spotify ?? null,
    progressMs: isFallback ? 0 : (track?.progress_ms ?? 0),
    durationMs: track?.duration_ms ?? 0,
    playedAt,
    artistSpotlight,
    recentTracks,
  };
}

export async function getNowPlayingOrLastPlayed(): Promise<NowPlayingData> {
  const accessToken = await getAccessToken();

  const nowPlayingResponse = await fetch(SPOTIFY_NOW_PLAYING_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const recentResponse = await fetch(SPOTIFY_RECENTLY_PLAYED_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!recentResponse.ok) {
    const text = await recentResponse.text();
    throw new Error(`Failed to fetch recent tracks: ${recentResponse.status} ${text}`);
  }

  const recentData = await recentResponse.json();
  const recentItems = Array.isArray(recentData?.items) ? recentData.items : [];
  const recentTracks = recentItems
    .filter((item: any) => item?.track)
    .map(mapHistoryTrack);

  if (nowPlayingResponse.ok && nowPlayingResponse.status !== 204) {
    const data = await nowPlayingResponse.json();
    const item = data?.item;

    if (item?.type === "track" && data?.is_playing) {
      const artistSpotlight = await getArtistSpotlight(accessToken, getPrimaryArtistId(item));

      return mapTrackToData(
        { ...item, progress_ms: data?.progress_ms ?? 0 },
        true,
        false,
        null,
        artistSpotlight,
        recentTracks,
      );
    }
  }

  const recentItem = recentItems[0];

  if (!recentItem?.track) {
    return {
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
      recentTracks,
    };
  }

  const artistSpotlight = await getArtistSpotlight(accessToken, getPrimaryArtistId(recentItem.track));

  return mapTrackToData(
    recentItem.track,
    false,
    true,
    recentItem.played_at ?? null,
    artistSpotlight,
    recentTracks,
  );
}
