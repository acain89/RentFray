const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function wallTime(instant: Date): number {
  const p = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour),
    Number(p.minute), Number(p.second), instant.getUTCMilliseconds());
}

/** 36 Chicago calendar months, preserving milliseconds and wall time.
 * Feb 29 clamps to Feb 28. A DST gap shifts forward by the gap; an overlap
 * chooses the earlier instant. This deliberately does not use billing helpers.
 */
export function representativeExpiration(start: Date): Date {
  if (!Number.isFinite(start.getTime())) throw new Error("Invalid representative clock start.");
  const wall = new Date(wallTime(start));
  const year = wall.getUTCFullYear() + 3;
  const month = wall.getUTCMonth();
  const day = Math.min(wall.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  const target = Date.UTC(year, month, day, wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds(), wall.getUTCMilliseconds());
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const instant = target + hours * 3600000;
    offsets.add(wallTime(new Date(instant)) - instant);
  }
  const candidates = [...offsets].map(offset => target - offset);
  const exact = candidates.filter(instant => wallTime(new Date(instant)) === target).sort((a, b) => a - b);
  if (exact.length) return new Date(exact[0]);
  const forward = candidates.filter(instant => wallTime(new Date(instant)) > target)
    .sort((a, b) => wallTime(new Date(a)) - wallTime(new Date(b)) || a - b);
  if (!forward.length) throw new Error("Cannot resolve representative calendar expiration.");
  return new Date(forward[0]);
}

export function representativeAgreementDates(effectiveAt: Date) {
  return { effectiveAt: new Date(effectiveAt), expiresAt: representativeExpiration(effectiveAt) };
}
