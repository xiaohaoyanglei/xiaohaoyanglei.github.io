import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

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
    "Research in computer vision, affective computing, deep learning, and machine learning for scientific data.";

  return {
    title,
    description,
    authors: [{ name: "Xiaohaoyang Lei" }],
    keywords: [
      "Xiaohaoyang Lei",
      "computer vision",
      "affective computing",
      "deep learning",
      "data science",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
