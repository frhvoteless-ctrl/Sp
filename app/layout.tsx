import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spotify Live",
  description: "A live Spotify now playing page built with Next.js",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
