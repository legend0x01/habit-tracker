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
