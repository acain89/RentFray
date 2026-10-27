"use client";
export default function RepresentativeAdminError({ reset }: { reset(): void }) {
  return <main style={{ padding: 32, maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif" }}><h1>Representative administration is temporarily unavailable.</h1><button onClick={reset}>Try again</button></main>;
}
