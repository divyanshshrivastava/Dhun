import type { Metadata, Viewport } from "next";
import { Space_Grotesk, DM_Sans, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["700"],
  fallback: ["sans-serif"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  fallback: ["system-ui", "sans-serif"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://dhun-psi.vercel.app"),
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
    url: "https://dhun-psi.vercel.app",
    siteName: "Dhun",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dhun (धुन) — Daily Indian Music Guessing Game",
    description: "Guess the Indian song from short audio snippets. 6 attempts, 15 seconds.",
    creator: "@dhungame",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#101216" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${dmSans.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Space+Grotesk:wght@700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('dhun_theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (saved === 'dark' || (!saved && prefersDark)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)] selection:bg-amber-500/25 selection:text-amber-900 dark:selection:text-amber-200">
        {children}
      </body>
    </html>
  );
}
