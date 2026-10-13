import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dhun (धुन) — Daily Indian Music Guessing Game",
  description:
    "Can you guess today's Indian song from short audio clips? A daily musical Heardle-style puzzle across Bollywood, Tollywood, Punjabi, Indie, and more.",
  keywords: [
    "Dhun",
    "Indian music game",
    "Songless",
    "Heardle India",
    "Bollywood song guessing game",
    "Hinglish song puzzle",
    "Daily music challenge",
  ],
  authors: [{ name: "Dhun Team" }],
  openGraph: {
    title: "Dhun (धुन) — Daily Indian Music Guessing Game",
    description: "Guess the Indian song from short audio snippets. 6 attempts, 15 seconds.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#080c14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#080c14] text-slate-100 selection:bg-amber-500/30 selection:text-amber-200">
        {children}
      </body>
    </html>
  );
}
