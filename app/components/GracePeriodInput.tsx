"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { gracePeriodError, gracePeriodInputMax, GRACE_PERIOD_LEGACY_MESSAGE, MAX_GRACE_PERIOD_DAYS } from "@/lib/gracePeriod";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "type"> & {
  value?: string;
  defaultValue?: number;
  savedValue?: number;
  serverError?: string;
};

export default function GracePeriodInput({ value, defaultValue = 0, savedValue, serverError, onChange, ...props }: Props) {
  const [draft, setDraft] = useState(String(defaultValue));
  const [edited, setEdited] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const current = value ?? draft;
  const error = (edited ? gracePeriodError(current, savedValue) : undefined) ?? serverError;
  useEffect(() => {
    input.current?.setCustomValidity(edited ? gracePeriodError(current, savedValue) ?? "" : "");
  }, [current, savedValue, edited]);
  return <>
    <input {...props} ref={input} type="number" inputMode="numeric" min={0} max={gracePeriodInputMax(current, savedValue)} step={1}
      value={current} aria-invalid={!!error} onChange={(event) => {
        setDraft(event.target.value);
        setEdited(true);
        event.target.setCustomValidity(gracePeriodError(event.target.value, savedValue) ?? "");
        onChange?.(event);
      }} onInvalid={(event) => {
        event.currentTarget.setCustomValidity(gracePeriodError(current, savedValue) ?? "");
        setEdited(true);
      }} />
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {savedValue !== undefined && savedValue > MAX_GRACE_PERIOD_DAYS &&
      <p className="text-sm text-gray-600">{GRACE_PERIOD_LEGACY_MESSAGE}</p>}
  </>;
}
