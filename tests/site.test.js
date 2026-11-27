// Checks that keep the installed app working offline. Run with: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const html = read("index.html");
const sw = read("sw.js");

test("every local script the page loads is precached by the service worker", () => {
  const local = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  assert.ok(local.includes("merge.js") && local.includes("config.js"));
  for (const s of local) assert.ok(sw.includes(`"${s}"`), `${s} is missing from PRECACHE in sw.js`);
});

test("the supabase-js version is the same in the page and the service worker", () => {
  const url = html.match(/<script src="(https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+)"/)[1];
  assert.ok(sw.includes(`"${url}"`), "update SUPABASE_JS in sw.js and bump VERSION");
});

test("every precached file and manifest icon exists", () => {
  const list = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
  for (const [, f] of list.matchAll(/"([^"]+)"/g)) {
    if (f === "./") continue;
    assert.ok(fs.existsSync(path.join(root, f)), `${f} is precached but doesn't exist`);
  }
  const manifest = JSON.parse(read("manifest.webmanifest"));
  for (const i of manifest.icons) assert.ok(fs.existsSync(path.join(root, i.src)), `${i.src} is missing`);
});

test("quotes.json has thousands of well-formed thoughts of the day", () => {
  const d = JSON.parse(read("quotes.json"));
  assert.ok(d.q.length >= 2000, `only ${d.q.length} quotes`);
  assert.deepEqual(d.cats, ["Stoic", "Mindfulness", "Realisation", "Motivating", "Wisdom"]);
  const seen = new Set();
  for (const [text, s, c] of d.q) {
    assert.ok(typeof text === "string" && text.length >= 20 && text.length <= 240, `bad length: ${text}`);
    assert.ok(d.src[s] && d.src[s][0], `no author for: ${text}`);
    assert.ok(c >= 0 && c < d.cats.length, `bad category for: ${text}`);
    const k = text.toLowerCase().replace(/[^a-z]/g, "");
    assert.ok(!seen.has(k), `duplicate: ${text}`); seen.add(k);
  }
  for (let i = 1; i < d.q.length; i++) assert.notEqual(d.q[i][2], d.q[i - 1][2], `two ${d.cats[d.q[i][2]]} days in a row at ${i}`);
});
