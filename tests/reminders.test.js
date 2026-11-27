// Push reminder rules used by the send-reminders Edge Function. Run with: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const load = () => import("../supabase/functions/send-reminders/logic.mjs");

const habit = (id, name, goal = 30) => ({ id, name, goals: Array(12).fill(goal) });

test("localNow(): the time in the device's own time zone", async () => {
  const { localNow } = await load();
  const at = new Date("2026-11-24T15:10:00Z");
  assert.deepEqual(localNow(at, "Asia/Kolkata"), { y: 2026, m: 10, d: 24, hh: 20, mm: 40, day: "2026-11-24" });
  assert.deepEqual(localNow(at, "Pacific/Auckland"), { y: 2026, m: 10, d: 25, hh: 4, mm: 10, day: "2026-11-25" }, "already tomorrow there");
  assert.equal(localNow(new Date("2026-11-24T00:05:00Z"), "UTC").hh, 0, "midnight is 00, not 24");
  assert.throws(() => localNow(at, "Not/AZone"), RangeError);
});

test("isDue(): once a day, at or after the chosen time", async () => {
  const { isDue } = await load();
  const now = { hh: 20, mm: 0, day: "2026-11-24" };
  assert.ok(isDue({ remind_at: "20:00", last_sent: null }, now), "on the minute");
  assert.ok(isDue({ remind_at: "19:30", last_sent: "2026-11-23" }, now), "sent yesterday, due again today");
  assert.ok(!isDue({ remind_at: "20:01", last_sent: null }, now), "not yet");
  assert.ok(!isDue({ remind_at: "19:00", last_sent: "2026-11-24" }, now), "already sent today");
  assert.ok(!isDue({ remind_at: "nonsense", last_sent: null }, now));
});

test("leftToday(): only today's active, unticked daily habits", async () => {
  const { leftToday } = await load();
  // 24 Nov 2026 is day-of-year 327 (0-based)
  const ticked = "0".repeat(327) + "1";
  const data = {
    habits: [habit("a", "Run"), habit("b", "Read"), { ...habit("c", "Off in Nov"), goals: Array(12).fill(0) }],
    checks: { a: ticked, b: "0".repeat(400) },
  };
  assert.deepEqual(leftToday(data, 2026, 10, 24).map(h => h.id), ["b"]);
  assert.deepEqual(leftToday(data, 2026, 10, 25).map(h => h.id), ["a", "b"], "yesterday's tick doesn't count today");
  assert.equal(leftToday(null, 2026, 10, 24), null, "year not set up");
  assert.deepEqual(leftToday({ habits: [habit("a", "Run")], checks: { a: ticked } }, 2026, 10, 24), [], "all done");
});

test("leftToday()/todayStatus(): habits on certain weekdays", async () => {
  const { leftToday, todayStatus } = await load();
  // 24 Nov 2026 is a Tuesday (day-of-year 327); Mon/Wed/Fri = bits 1,3,5 = 42
  const data = { habits: [habit("a", "Run"), { ...habit("g", "Gym"), days: 42 }], checks: {} };
  assert.deepEqual(leftToday(data, 2026, 10, 24).map(h => h.id), ["a"], "Gym isn't on Tuesdays");
  assert.deepEqual(leftToday(data, 2026, 10, 25).map(h => h.id), ["a", "g"], "but it is on Wednesday");
  assert.equal(todayStatus(data, 2026, 10, 24).total, 1);
  // ticked Mon 23 and Fri 20, not Sat/Sun: the weekend doesn't break Gym's streak
  const s = "0".repeat(323) + "1" + "00" + "1";
  const st = todayStatus({ ...data, checks: { g: s, a: s } }, 2026, 10, 24); // streaks up to yesterday (Mon)
  assert.equal(st.streakOf(data.habits[1]), 2, "Gym: Mon + Fri, weekend skipped");
  assert.equal(st.streakOf(data.habits[0]), 1, "Run (every day): broken by Sunday");
});

test("reminderText(): same wording as the in-app reminder", async () => {
  const { reminderText } = await load();
  assert.equal(reminderText([habit("a", "Run")]), '"Run" is still open today.');
  assert.equal(reminderText(["A", "B", "C", "D"].map(n => habit(n, n))), "4 habits still open today: A, B, C…");
  assert.equal(reminderText([habit("a", "  "), habit("b", "Read")]), "2 habits still open today: Untitled, Read");
});

test("pushHostOk(): only real browser push services, and the database agrees", async () => {
  const { pushHostOk, PUSH_HOSTS } = await load();
  for (const ok of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://wns2-par02p.notify.windows.com/w/?token=x", "https://web.push.apple.com/abc"]) assert.ok(pushHostOk(ok), ok);
  for (const bad of ["http://fcm.googleapis.com/x", "https://evil.example/fcm.googleapis.com/x", "https://fcm.googleapis.com.evil.example/x",
    "https://169.254.169.254/latest", "not a url"]) assert.ok(!pushHostOk(bad), bad);
  const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
  for (const h of PUSH_HOSTS) assert.ok(schema.includes(h.replace(/\./g, "\\.")), `${h} is missing from the push_subscriptions endpoint check`);
});

test("sameSecret(): exact match only, never an empty secret", async () => {
  const { sameSecret } = await load();
  assert.ok(sameSecret("abc123", "abc123"));
  assert.ok(!sameSecret("abc124", "abc123"));
  assert.ok(!sameSecret("abc", "abc123"));
  assert.ok(!sameSecret("", ""), "an unset CRON_SECRET must not let empty headers through");
  assert.ok(!sameSecret(null, undefined));
});

test("the service worker shows push reminders and config has a valid public key", () => {
  assert.match(fs.readFileSync(path.join(root, "sw.js"), "utf8"), /addEventListener\("push"/);
  const key = fs.readFileSync(path.join(root, "config.js"), "utf8").match(/vapidPublicKey:\s*"([^"]*)"/)[1];
  assert.ok(key === "" || Buffer.from(key, "base64url").length === 65, "vapidPublicKey must be an uncompressed P-256 public key (65 bytes)");
});

test("the Edge Function, its schedule, the database and the app agree", () => {
  const read = f => fs.readFileSync(path.join(root, f), "utf8");
  const fn = read("supabase/functions/send-reminders/index.ts"), cron = read("supabase/reminders-cron.sql");
  const schema = read("supabase/schema.sql"), html = read("index.html");
  assert.match(fn, /from "\.\/logic\.mjs"/, "the function uses the tested rules");
  assert.match(cron, /\/functions\/v1\/send-reminders'/, "the schedule calls the function by its folder name");
  assert.ok(fn.includes('"x-cron-secret"') && cron.includes("'x-cron-secret'"), "same secret header on both sides");
  assert.match(cron, /cron\.schedule\(\s*'send-reminders',\s*'\*\/5 \* \* \* \*'/, "runs every 5 minutes");
  const table = schema.split("create table if not exists public.push_subscriptions")[1].split(");")[0];
  const cols = [...table.matchAll(/^ {2}([a-z_0-9]+)\s/gm)].map(m => m[1]);
  for (const col of ["endpoint", "user_id", "p256dh", "auth", "remind_at", "tz", "last_sent"]) {
    assert.ok(cols.includes(col), `push_subscriptions.${col} exists`);
    assert.ok(fn.includes(col), `the function reads ${col}`);
  }
  assert.ok(html.includes('from("push_subscriptions")') && fn.includes('from("push_subscriptions")'));
  assert.match(read("supabase/functions/send-reminders/deno.json"), /"nodeModulesDir":\s*"none"/, "deploys without node_modules");
  assert.ok(read(".gitignore").includes("supabase/.local/"), "server secrets stay out of git");
});
