import type { ReactNode } from "react";

export function CheckMark() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 10.5 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function XMark() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

export function DetailSection({
  eyebrow,
  title,
  text,
  children,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  children?: ReactNode;
  dark?: boolean;
}) {
  return (
    <section className={`rfp-section${dark ? " rfp-section-dark" : ""}`}>
      <div className="rfm-container">
        <span className="rfp-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {text ? <p className="rfp-section-intro">{text}</p> : null}
        {children}
      </div>
    </section>
  );
}

export function DetailCard({ number, title, text }: { number?: string; title: string; text: string }) {
  return (
    <article className="rfp-card">
      {number ? <b>{number}</b> : null}
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

export function Checklist({ items, negative = false }: { items: readonly string[]; negative?: boolean }) {
  return (
    <div className={`rfp-checklist${negative ? " is-negative" : ""}`}>
      {items.map((item) => (
        <div key={item}>
          <span>{negative ? <XMark /> : <CheckMark />}</span>
          <p>{item}</p>
        </div>
      ))}
    </div>
  );
}
