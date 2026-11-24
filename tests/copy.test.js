// Reminder wording (supabase/functions/send-reminders/copy.mjs). Run with: npm test
const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../supabase/functions/send-reminders/copy.mjs");
const H = (name, i = 0) => ({ id: "h" + i, name });
const STARTER = ["Plan my day", "Wake up by 6:30 am", "Drink 2.5L of water", "Stretch for 10 mins", "Study for 1 hour",
  "DSA practice (2 problems)", "Read 10 pages", "Strength training", "Go for a walk / cardio", "Spend time with family",
  "Practice mindfulness", "No junk food", "No screen 1 hr before sleep", "Sleep by 11 pm"].map(H);
const days = (n, from = "2026-12-01") => Array.from({ length: n }, (_, k) =>
  new Date(Date.parse(from + "T00:00:00Z") + k * 864e5).toISOString().slice(0, 10));
const len = s => [...s].length;

test("themeOf(): every starter habit gets the right theme", async () => {
  const { themeOf } = await load();
  assert.deepEqual(STARTER.map(h => themeOf(h.name)), ["plan", "wake", "water", "stretch", "study", "code", "reading",
    "workout", "move", "family", "mind", "junk", "screen", "sleep"]);
  assert.equal(themeOf("Finish my book"), "reading");
  assert.equal(themeOf("10k steps"), "move");
  assert.equal(themeOf("Make my bed"), "clean", "not a sleep reminder");
  assert.equal(themeOf("Water the plants twice"), "water");
  assert.equal(themeOf("Something unusual"), "any");
  assert.equal(themeOf(""), "any");
});

test("every theme has lines, and every line renders cleanly and fits a notification", async () => {
  const { THEMES, LINES, STREAK, LAST_ONE, NONE_YET, LATE } = await load();
  for (const [t] of THEMES) assert.ok(LINES[t] && LINES[t].length >= 2, `${t} needs at least 2 lines`);
  const all = [...Object.values(LINES).flat(), ...STREAK, ...LAST_ONE, ...NONE_YET, ...LATE];
  const name = "A habit with a long name that…"; // names are cut to 32 characters
  for (const [t, b] of all) {
    const f = x => x.replace(/\{h\}/g, name).replace(/\{s\}/g, "365").replace(/\{n\}/g, "366").replace(/\{more\}/g, " (+49 more)");
    const title = f(t), body = f(b);
    assert.ok(!/[{}]/.test(title + body), `unfilled placeholder in: ${t} | ${b}`);
    assert.ok(len(title) <= 48, `title too long (${len(title)}): ${title}`);
    assert.ok(len(body) <= 150, `body too long (${len(body)}): ${body}`);
  }
});

test("no brand names in the wording", async () => {
  const { LINES, STREAK, LAST_ONE, NONE_YET, LATE } = await load();
  const text = JSON.stringify([LINES, STREAK, LAST_ONE, NONE_YET, LATE]).toLowerCase();
  for (const b of ["netflix", "skittles", "leetcode", "duolingo", "blinkit", "zomato", "swiggy", "instagram", "youtube", "spotify"])
    assert.ok(!text.includes(b), `${b} appears in reminder copy`);
});

test("reminderMessage(): a streak about to break comes first", async () => {
  const { reminderMessage } = await load();
  const left = [STARTER[6], STARTER[2]];
  for (const day of days(8)) { // every streak line, whatever the day
    const m = reminderMessage({ left, total: 14, streakOf: h => (h.id === "h6" ? 12 : 0), day });
    assert.match(m.title + m.body, /12/, day);
    assert.match(m.body, /Read 10 pages/, day);
  }
  const short = reminderMessage({ left, total: 14, streakOf: () => 2, day: "2026-12-01" });
  assert.doesNotMatch(short.title, /streak|days strong/i, "2 days isn't a streak worth an alarm");
});

test("reminderMessage(): one left after a good day; all done; deterministic", async () => {
  const { reminderMessage, LAST_ONE } = await load();
  const m = reminderMessage({ left: [STARTER[6]], total: 14, day: "2026-12-01" });
  assert.ok(LAST_ONE.some(([t]) => t === m.title));
  assert.match(m.body, /Read 10 pages/);
  assert.match(reminderMessage({ left: [], total: 14 }).title, /All done/);
  const args = { left: STARTER, total: 14, day: "2026-12-05", seed: "dev", hour: 20 };
  assert.deepEqual(reminderMessage(args), reminderMessage(args));
});

test("reminderMessage(): never features a morning habit in the evening when others are open", async () => {
  const { reminderMessage } = await load();
  const left = [STARTER[0], STARTER[1], STARTER[6]];
  for (const day of days(30)) {
    const m = reminderMessage({ left, total: 14, day, seed: "dev", hour: 20 });
    assert.doesNotMatch(m.title + m.body, /Wake up|Plan my day|rise and shine|Early bird|Plans > panic|Tomorrow-you/, day);
  }
  const morning = days(30).map(day => reminderMessage({ left: [STARTER[1]], total: 2, day, hour: 8 }).body);
  assert.ok(morning.some(b => b.includes("Wake up")), "a lone morning habit still gets reminded");
});

test("reminderMessage(): rotates day by day without repeating itself", async () => {
  const { reminderMessage } = await load();
  for (const seed of ["device-A", "device-B", ""]) {
    const titles = days(28).map(day => reminderMessage({ left: STARTER.slice(0, 11), total: 14, day, seed, hour: 20 }).title);
    assert.ok(new Set(titles).size >= 25, `${seed}: only ${new Set(titles).size} different titles in 28 days`);
    for (let k = 1; k < titles.length; k++) assert.notEqual(titles[k], titles[k - 1], `${seed}: same title two days running`);
  }
  const a = reminderMessage({ left: STARTER, total: 14, day: "2026-12-01", seed: "device-A" });
  const b = reminderMessage({ left: STARTER, total: 14, day: "2026-12-01", seed: "device-B" });
  assert.notDeepEqual(a, b, "two devices don't buzz with the same line");
});

test("todayStatus(): streaks count up to yesterday, honouring the carry setting", async () => {
  const { todayStatus } = await import("../supabase/functions/send-reminders/logic.mjs");
  const goals = Array(12).fill(30), i = 336; // 3 Dec 2026 is day 336 (0-based)
  const ticks = n => "0".repeat(i - n) + "1".repeat(n) + "0";
  const data = { habits: [{ id: "a", name: "Read", goals }, { id: "b", name: "Run", goals }], checks: { a: ticks(5), b: ticks(0) } };
  const s = todayStatus(data, 2026, 11, 3);
  assert.equal(s.total, 2);
  assert.deepEqual(s.left.map(h => h.id), ["a", "b"]);
  assert.equal(s.streakOf(s.left[0]), 5);
  assert.equal(s.streakOf(s.left[1]), 0);
  assert.equal(todayStatus({ ...data, carry: false }, 2026, 11, 3).streakOf(s.left[0]), 2, "restarts on the 1st");
  assert.equal(todayStatus(null, 2026, 11, 3), null);
});

test("the push server and the app both use the copy", () => {
  const fs = require("node:fs"), path = require("node:path"), root = path.join(__dirname, "..");
  const fn = fs.readFileSync(path.join(root, "supabase/functions/send-reminders/index.ts"), "utf8");
  assert.match(fn, /reminderMessage\(\{ \.\.\.today, day: t\.day/);
  assert.match(fn, /title: msg\.title, body: msg\.body/);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(html.includes('import("./supabase/functions/send-reminders/copy.mjs")'));
  assert.ok(fs.readFileSync(path.join(root, "sw.js"), "utf8").includes('"supabase/functions/send-reminders/copy.mjs"'), "precached for offline");
});
