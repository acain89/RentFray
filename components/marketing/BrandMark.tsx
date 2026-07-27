type BrandMarkProps = {
  compact?: boolean;
};

export default function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span className={`rfm-brand${compact ? " rfm-brand-compact" : ""}`}>
      <span className="rfm-brand-mark" aria-hidden="true">RF</span>
      <span>RentFray</span>
    </span>
  );
}
