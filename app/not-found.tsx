import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found | Xiaohaoyang Lei",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="not-found shell" id="main-content">
      <p className="not-found-code" aria-hidden="true">
        404
      </p>
      <h1>This frame was never sampled.</h1>
      <p>The page you asked for doesn’t exist, or it has moved.</p>
      <a href="/">Back to the homepage</a>
    </main>
  );
}
