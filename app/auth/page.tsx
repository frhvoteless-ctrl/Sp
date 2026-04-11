type AuthPageProps = {
  searchParams: Promise<{
    refresh_token?: string;
    error?: string;
    saved?: string;
    warning?: string;
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const refreshToken = params.refresh_token;
  const error = params.error;
  const saved = params.saved === "1";
  const warning = params.warning;

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-12 text-white">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-white/6 p-8 backdrop-blur-xl">
        <h1 className="text-3xl font-bold">Spotify Auth</h1>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-100">
            <p className="font-medium">Error</p>
            <p className="mt-2 break-words text-sm">{error}</p>
          </div>
        ) : saved ? (
          <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-500/10 p-4 text-green-100">
            <p className="font-medium">Success</p>
            <p className="mt-2 text-sm">
              Your refresh token was saved to <code>.env.local</code>. Restart your dev server so Next.js reloads the env file.
            </p>
          </div>
        ) : refreshToken ? (
          <>
            <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4 text-yellow-100">
              <p className="font-medium">Token received</p>
              <p className="mt-2 text-sm">
                Auto-save could not complete here, so copy this refresh token into <code>SPOTIFY_REFRESH_TOKEN</code> in your env file.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="mb-2 text-sm text-white/60">Refresh token</p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all text-sm text-white">
                {refreshToken}
              </pre>
            </div>
          </>
        ) : (
          <p className="mt-6 text-white/70">No auth result found.</p>
        )}

        {warning && !error && (
          <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4 text-yellow-100">
            <p className="font-medium">Auto-save note</p>
            <p className="mt-2 break-words text-sm">{warning}</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/"
            className="inline-block rounded-full border border-white/12 bg-white/8 px-5 py-2.5 text-sm text-white transition hover:bg-white/12"
          >
            Back home
          </a>
          <a
            href="/api/spotify/login"
            className="inline-block rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:scale-[1.02]"
          >
            Connect again
          </a>
        </div>
      </div>
    </main>
  );
}
