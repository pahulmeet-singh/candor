"use client";

/**
 * The last line of defence: it replaces the root layout when the layout
 * itself throws. Because the layout (and with it globals.css) is gone, this
 * file renders its own <html> and <body> and styles itself inline.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#0a1d21",
          color: "#f3ead6",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main style={{ maxWidth: 480, padding: 24 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 32, margin: "0 0 12px" }}>Candor hit a problem.</h1>
          <p style={{ color: "#9bb2ae", lineHeight: 1.6, margin: "0 0 20px" }}>
            Something failed while loading the app. Reload the page; if it keeps happening, try again in a few minutes.
          </p>
          {error.digest ? <p style={{ color: "#7f9a96", fontSize: 14 }}>Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#f4d03f",
              color: "#0a1d21",
              border: 0,
              borderRadius: 10,
              padding: "10px 18px",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
