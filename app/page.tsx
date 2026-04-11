import NowPlayingCard from "@/components/now-playing-card";

export default function HomePage() {
  return (
    <main className="home-page">
      <div className="ambient ambient-1" />
      <div className="ambient ambient-2" />
      <div className="ambient ambient-3" />

      <div className="home-center">
        <NowPlayingCard />
      </div>
    </main>
  );
}