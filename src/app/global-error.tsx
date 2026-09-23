"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            fontFamily: "system-ui, sans-serif",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.5rem", color: "#666" }}>
            {error.message || "An unexpected error occurred."}
          </p>
          {error.digest && (
            <p style={{ marginTop: "0.25rem", color: "#999", fontSize: "0.75rem" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1.5rem",
              borderRadius: "0.375rem",
              border: "1px solid #ccc",
              cursor: "pointer",
              background: "#000",
              color: "#fff",
            }}
          >
            Try Again
          </button>
        </main>
      </body>
    </html>
  );
}
