// Soma minutos no instante da unidade. O relógio local pode saltar em horário de verão.
export function addLocalMinutes(
  start: string,
  minutes: number,
  timeZone: string,
) {
  if (!Number.isFinite(minutes)) return null
  try {
    const utc = localToUtc(start, timeZone)
    if (utc === null) return null
    return utcToLocal(utc + minutes * 60000, timeZone)
  } catch {
    return null
  }
}

function wallClock(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [y, mo, d, h, mi] = match.slice(1).map(Number)
  if ([y, mo, d, h, mi].some((n) => !Number.isInteger(n))) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null
  return Date.UTC(y, mo - 1, d, h, mi)
}

function zoneParts(timeZone: string, utcMs: number) {
  const bag: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') bag[part.type] = part.value
  }
  if (bag.hour === '24') bag.hour = '00'
  return bag
}

function offsetMs(timeZone: string, utcMs: number) {
  const bag = zoneParts(timeZone, utcMs)
  const asUtc = Date.UTC(
    Number(bag.year),
    Number(bag.month) - 1,
    Number(bag.day),
    Number(bag.hour),
    Number(bag.minute),
    Number(bag.second),
  )
  return asUtc - utcMs
}

function localToUtc(value: string, timeZone: string) {
  const guess = wallClock(value)
  if (guess === null) return null
  const utc = guess - offsetMs(timeZone, guess - offsetMs(timeZone, guess))
  return Number.isFinite(utc) ? utc : null
}

function utcToLocal(utcMs: number, timeZone: string) {
  if (!Number.isFinite(utcMs)) return null
  const bag = zoneParts(timeZone, utcMs)
  return `${bag.year}-${bag.month}-${bag.day}T${bag.hour}:${bag.minute}`
}
