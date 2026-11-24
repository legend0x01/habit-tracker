// Sync merge tests. Run with: npm test   (or: node --test)
// B = last copy both sides agreed on, L = this device, R = the cloud.
const test = require("node:test");
const assert = require("node:assert/strict");
const { same, sameY, pick, mergeBits, mergeList, mergeYear } = require("../merge.js");

const habit = (id, name, extra = {}) => ({ id, name, cat: "", goals: Array(12).fill(30), ...extra });
const weekly = (id, name) => ({ id, name, months: Array(12).fill(1) });
const year = (over = {}) => ({
  v: 1, year: 2026, carry: true, cats: [], habits: [], weekly: [],
  checks: {}, wchecks: {}, notes: Array(12).fill(""), updatedAt: 1, ...over,
});
const copy = o => structuredClone(o);

test("same() ignores key order but not array order", () => {
  assert.ok(same({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 }));
  assert.ok(!same([1, 2], [2, 1]));
  assert.ok(!same({ a: 1 }, { a: 1, b: undefined }));
  assert.ok(sameY(year({ updatedAt: 5 }), year({ updatedAt: 9 })), "updatedAt is ignored");
});

test("pick(): the side that changed wins, this device wins a real conflict", () => {
  assert.equal(pick("a", "a", "b"), "b", "only the cloud changed it");
  assert.equal(pick("a", "b", "a"), "b", "only this device changed it");
  assert.equal(pick("a", "b", "c"), "b", "both changed it");
  assert.equal(pick(null, "short", "a longer note", true), "a longer note", "no history: keep the longer text");
});

test("mergeBits(): ticks merge day by day", () => {
  assert.equal(mergeBits("000", "100", "001"), "101", "different days ticked on each device");
  assert.equal(mergeBits("110", "010", "110"), "010", "an untick here survives");
  assert.equal(mergeBits("110", "110", "100"), "100", "an untick on the other device survives");
  assert.equal(mergeBits(null, "100", "010"), "110", "no history: keep every tick");
  assert.equal(mergeBits(null, "1", "001"), "101", "different lengths are padded");
});

test("mergeList(): additions on both sides are kept, deletions stick", () => {
  const a = habit("a", "A"), b = habit("b", "B"), c = habit("c", "C"), d = habit("d", "D");
  const keepL = (_b, l) => l;
  assert.deepEqual(mergeList([a], [a, b], [a, c], keepL).map(x => x.id), ["a", "c", "b"], "both kept; the remote one at its remote position");
  assert.deepEqual(mergeList([a, b], [a], [a, b], keepL).map(x => x.id), ["a"], "deleted here");
  assert.deepEqual(mergeList([a, b], [a, b], [a], keepL).map(x => x.id), ["a"], "deleted on the other device");
  const bEdited = { ...b, name: "B2" };
  assert.deepEqual(mergeList([a, b], [a, bEdited], [a], keepL).map(x => x.name), ["A", "B2"], "edited here after the other device deleted it");
  assert.deepEqual(mergeList([a, b], [a, b], [d, a, b], keepL).map(x => x.id), ["d", "a", "b"], "remote addition keeps its position");
});

test("mergeYear(): a rename on one device and a goal change on the other both survive", () => {
  const B = year({ habits: [habit("h1", "Run")] });
  const L = copy(B); L.habits[0].goals[3] = 10;
  const R = copy(B); R.habits[0].name = "Run 5k";
  const M = mergeYear(B, L, R);
  assert.equal(M.habits[0].name, "Run 5k");
  assert.equal(M.habits[0].goals[3], 10);
});

test("mergeYear(): ticks from both devices are kept; a deleted habit's ticks go", () => {
  const B = year({ habits: [habit("h1", "Run"), habit("h2", "Read")], checks: { h1: "000", h2: "000" } });
  const L = copy(B); L.checks.h1 = "100";
  const R = copy(B); R.checks.h1 = "001"; R.habits = R.habits.filter(h => h.id !== "h2"); delete R.checks.h2;
  const M = mergeYear(B, L, R);
  assert.equal(M.checks.h1, "101");
  assert.deepEqual(M.habits.map(h => h.id), ["h1"]);
  assert.ok(!("h2" in M.checks));
});

test("mergeYear(): weekly habits and notes merge per month", () => {
  const B = year({ weekly: [weekly("w1", "Laundry")], wchecks: { w1: "00000" } });
  const L = copy(B); L.notes[0] = "Jan note"; L.wchecks.w1 = "10000";
  const R = copy(B); R.notes[5] = "Jun note"; R.weekly[0].months[2] = 0; R.wchecks.w1 = "00001";
  const M = mergeYear(B, L, R);
  assert.equal(M.notes[0], "Jan note");
  assert.equal(M.notes[5], "Jun note");
  assert.equal(M.weekly[0].months[2], 0);
  assert.equal(M.wchecks.w1, "10001");
});

test("mergeYear(): category edits from both devices survive", () => {
  const B = year({ cats: [{ id: "c1", name: "Health", col: "#22c55e" }], habits: [habit("h1", "Run")] });
  const L = copy(B); L.habits[0].cat = "c1";
  const R = copy(B); R.cats[0].col = "#f97316"; R.cats.push({ id: "c2", name: "Work", col: "#3b82f6" });
  const M = mergeYear(B, L, R);
  assert.deepEqual(M.cats.map(c => c.name + c.col), ["Health#f97316", "Work#3b82f6"]);
  assert.equal(M.habits[0].cat, "c1");
});

test("mergeYear(): a base saved before categories existed still counts as history", () => {
  const B = year({ habits: [{ id: "h1", name: "Run", goals: Array(12).fill(30) }] });
  delete B.cats;
  const L = year({ cats: [{ id: "c9", name: "Fit", col: "#22c55e" }], habits: [habit("h1", "Run", { cat: "c9" })] });
  const R = year({ habits: [habit("h1", "Run")] });
  const M = mergeYear(B, L, R);
  assert.equal(M.habits[0].cat, "c9", "this device's assignment is not dropped");
  assert.deepEqual(M.cats.map(c => c.id), ["c9"]);
});

test("mergeYear(): no-op merge, newest updatedAt, inputs untouched", () => {
  const B = year({ habits: [habit("h1", "Run")], checks: { h1: "010" } });
  const L = copy(B); L.updatedAt = 50;
  const R = copy(B); R.updatedAt = 70;
  const before = copy([B, L, R]);
  const M = mergeYear(B, L, R);
  assert.ok(sameY(M, L));
  assert.equal(M.updatedAt, 70);
  assert.deepEqual([B, L, R], before);
});
