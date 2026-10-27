"use client";
export default function RepresentativePortalError({ reset }: { reset: () => void }) {
  return <main style={{ maxWidth: 600, padding: 32, margin: "60px auto", fontFamily: "sans-serif" }}>
    <h1>Your report is temporarily unavailable.</h1><p>Please try again in a moment.</p><button onClick={reset}>Try again</button>
  </main>;
}
