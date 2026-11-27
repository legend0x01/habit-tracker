/* Daily reminder rules for the send-reminders Edge Function. Plain JS with no imports, so
   tests/reminders.test.js can check it with Node. Mirrors leftToday()/remindText() in index.html. */

/* push services browsers use (Chrome/Android, Firefox, Edge, Safari); anything else is refused */
export const PUSH_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com"];

export function pushHostOk(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some(h => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

/* the date and time it is right now for someone in time zone tz; throws RangeError for an unknown zone */
export function localNow(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month - 1, d: +p.day, hh: +p.hour, mm: +p.minute, day: `${p.year}-${p.month}-${p.day}` };
}

/* due once a day: at or after the chosen time, and not yet sent on this local day */
export function isDue(sub, now) {
  const [h, m] = String(sub.remind_at).split(":").map(Number);
  if (!(h >= 0 && h < 24 && m >= 0 && m < 60)) return false;
  return now.hh * 60 + now.mm >= h * 60 + m && sub.last_sent !== now.day;
}

/* the weekdays a daily habit repeats on: bitmask, bit 0 = Sunday … bit 6 = Saturday; missing = every day */
export const hDays = h => { const v = +(h && h.days); return Number.isInteger(v) && v > 0 && v < 127 ? v : 127; };
/* is the habit on for day-of-year i of year y (i may be negative = last year) */
export const onDay = (h, y, i) => ((hDays(h) >> new Date(Date.UTC(y, 0, 1 + i)).getUTCDay()) & 1) === 1;

/* daily habits active this month and on this weekday */
const activeToday = (data, y, m, i) =>
  data.habits.filter(h => h && Array.isArray(h.goals) && (+h.goals[m] || 0) > 0 && onDay(h, y, i));

/* today's active daily habits that aren't ticked; null when that year isn't set up */
export function leftToday(data, y, m, d) {
  if (!data || !Array.isArray(data.habits)) return null;
  const i = Math.round((Date.UTC(y, m, d) - Date.UTC(y, 0, 1)) / 864e5);
  const checks = data.checks && typeof data.checks === "object" ? data.checks : {};
  return activeToday(data, y, m, i).filter(h => String(checks[h.id] || "").charCodeAt(i) !== 49);
}

/* everything the reminder copy needs about today: unticked habits, how many are active, and each habit's
   streak up to yesterday (restarting on the 1st when the year's "carry streaks" setting is off) */
export function todayStatus(data, y, m, d) {
  const left = leftToday(data, y, m, d);
  if (!left) return null;
  const i = Math.round((Date.UTC(y, m, d) - Date.UTC(y, 0, 1)) / 864e5);
  const lo = data.carry === false ? Math.round((Date.UTC(y, m, 1) - Date.UTC(y, 0, 1)) / 864e5) : 0;
  const checks = data.checks && typeof data.checks === "object" ? data.checks : {};
  const total = activeToday(data, y, m, i).length;
  const streakOf = h => { // a day the habit isn't on doesn't break the streak
    const s = String(checks[h.id] || "");
    let n = 0;
    for (let k = i - 1; k >= lo; k--) {
      if (s.charCodeAt(k) === 49) n++;
      else if (onDay(h, y, k)) break;
    }
    return n;
  };
  return { left, total, streakOf };
}

export function reminderText(left) {
  const names = left.slice(0, 3).map(h => String(h.name || "").trim() || "Untitled").join(", ");
  return left.length === 1 ? `"${names}" is still open today.`
    : `${left.length} habits still open today: ${names}${left.length > 3 ? "…" : ""}`;
}

/* constant-time comparison for the cron secret */
export function sameSecret(a, b) {
  a = String(a || ""); b = String(b || "");
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0 && a.length > 0;
}
