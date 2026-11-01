import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import Starfield from "./starfield";
import "./globals.css";

// Fonts are self-hosted from npm packages (latin subset only), so the page
// makes no requests to Google Fonts. That matters for readers in mainland China.
// Body text is set in a serif, like a paper; the sans is for interface bits.
const serif = localFont({
  src: [
    {
      path: "../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-opsz-normal.woff2",
      weight: "200 900",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-opsz-italic.woff2",
      weight: "200 900",
      style: "italic",
    },
  ],
  variable: "--font-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const sans = localFont({
  src: "../node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
  weight: "100 700",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
});

const mono = localFont({
  src: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

export const viewport: Viewport = {
  themeColor: "#0a1020",
  colorScheme: "dark",
};

export async function generateMetadata(): Promise<Metadata> {
  // GitHub Pages has no request-time server. Keep Sites request metadata while
  // providing a stable canonical origin for its independent static export.
  let origin = process.env.SITE_URL ?? "https://xiaohaoyanglei.github.io";
  if (process.env.GITHUB_PAGES !== "true") {
    const headerStore = await headers();
    const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
    const protocol = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
    origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  }
  origin = origin.replace(/\/$/, "");
  const title = "Xiaohaoyang Lei | Academic Homepage";
  const description =
    "Xiaohaoyang Lei, M.Sc. student at Monash University, works on generative models for image editing and video generation, with earlier work in affective computing and computer vision.";

  return {
    title,
    description,
    authors: [{ name: "Xiaohaoyang Lei" }],
    keywords: [
      "Xiaohaoyang Lei",
      "image editing",
      "video generation",
      "diffusion models",
      "world models",
      "computer vision",
      "affective computing",
      "Monash University",
    ],
    alternates: { canonical: origin },
    openGraph: {
      type: "website",
      url: origin,
      title,
      description,
      siteName: "Xiaohaoyang Lei",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Xiaohaoyang Lei academic homepage" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Starfield />
        {children}
      </body>
    </html>
  );
}
