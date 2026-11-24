/* Reminder copy: a playful, habit-aware title and body for the daily reminder.
   Plain JS with no imports, used by the send-reminders Edge Function (push), by the app (in-app reminder
   and "Send a test") and by tests/copy.test.js. {h} = habit name, {s} = streak, {n} = days in a row tomorrow,
   {more} = " (+2 more)" when other habits are open too. */

/* what a habit is about, from its name. First match wins, so specific themes come before broad ones. */
export const THEMES = [
  ["prayer", /\b(pray|prayer|namaz|salah|puja|pooja|bible|quran|gita|church|temple|mass)\b/],
  ["reading", /\b(read|reading|book|books|pages?|novel|chapters?|kindle|audiobook)\b/],
  ["water", /\b(water|hydrat\w*|litres?|liters?|glass(es)? of)\b/],
  ["code", /\b(dsa|leetcode|cod(e|ing)|program(ming)?|algorithms?|problems?|commit|github)\b/],
  ["study", /\b(study|studying|learn\w*|course|revis\w*|revision|homework|exam|lecture|notes|flashcards?)\b/],
  ["language", /\b(language|spanish|french|german|japanese|korean|hindi|english|vocab\w*|duolingo)\b/],
  ["screen", /\b(screen|phone|social media|scroll\w*|reels|instagram|youtube|doomscroll\w*)\b/],
  ["junk", /\b(junk|sugar|soda|fried|fast food|takeaway|takeout|sweets|chips)\b/],
  ["clean", /\bmake (my|the) bed\b/],
  ["sleep", /\b(sleep|bed|bedtime|nap)\b/],
  ["wake", /\b(wake|waking|alarm|early rise|sunrise)\b/],
  ["stretch", /\b(stretch\w*|yoga|mobility|posture)\b/],
  ["workout", /\b(gym|workout|work out|exercise|strength|lift\w*|weights|push-?ups?|squats?|plank|training|abs)\b/],
  ["move", /\b(walk\w*|run|running|jog\w*|cardio|steps|cycl\w*|swim\w*|hike)\b/],
  ["mind", /\b(meditat\w*|mindful\w*|breath\w*|gratitude|calm)\b/],
  ["journal", /\b(journal\w*|diary|write|writing|blog)\b/],
  ["family", /\b(family|mom|mum|dad|parents?|call|friends?|grandma|grandpa|sibling|partner)\b/],
  ["plan", /\b(plan|planning|to-?do|priorit\w*|schedule|review my)\b/],
  ["food", /\b(fruit|veg\w*|salad|protein|healthy|meal|breakfast|vitamins?|supplements?)\b/],
  ["clean", /\b(clean\w*|tidy|laundry|dishes|declutter|room|bed making|make my bed)\b/],
  ["music", /\b(guitar|piano|violin|drums|sing\w*|music|instrument|ukulele|flute)\b/],
  ["care", /\b(skin\w*|floss\w*|teeth|brush\w*|sunscreen|meds|medicine|pills?)\b/],
];

export function themeOf(name) {
  const n = " " + String(name || "").toLowerCase() + " ";
  for (const [t, re] of THEMES) if (re.test(n)) return t;
  return "any";
}

/* [title, body] pairs per theme */
export const LINES = {
  reading: [
    ["Your book called 📚", "It says you left it on a cliffhanger. Come back for 10 pages?{more}"],
    ["Plot twist: you read today 📖", "Pages don't turn themselves. Yet.{more}"],
    ["The bookmark is lonely 🔖", "It's held the same page all day. Go rescue it."],
    ["Main character energy ✨", "Main characters read before bed. Just saying.{more}"],
    ["Your show can wait 🍿", "Your book has better plot twists. \"{h}\" is still open."],
    ["Chapter one of tonight 🌙", "Brew a tea, open the book, tick \"{h}\". In that order."],
  ],
  water: [
    ["Hydration check 💧", "You're 60% water and 40% asking for more. Drink up.{more}"],
    ["Plants get watered. Do you? 🪴", "\"{h}\" is still open. Glug glug."],
    ["Glass half empty? 🥛", "Make it fully empty. Into you, ideally."],
    ["Sip happens 💦", "Your bottle has been staring at you all day.{more}"],
    ["Low battery: H₂O 🔋", "Recharge with a glass of water, then tick \"{h}\"."],
  ],
  code: [
    ["Bug found in your day 🐛", "\"{h}\" hasn't been compiled yet. Ship it.{more}"],
    ["while (!done) remind(you) 🔁", "Break the loop: tick \"{h}\"."],
    ["Your future interviewer says hi 👋", "Two problems today, and they'll be impressed."],
    ["git commit -m \"today\" 💻", "Your streak needs today's commit. \"{h}\" is open."],
    ["O(1) effort, O(n) gains 📈", "Start one problem. Momentum does the rest.{more}"],
  ],
  study: [
    ["Future you is watching 👀", "And they're a little nervous. \"{h}\"?{more}"],
    ["Brain gym is open 🧠", "No membership fee, just 25 focused minutes."],
    ["Knowledge doesn't auto-download 📚", "Manual install required: \"{h}\"."],
    ["One Pomodoro, please 🍅", "25 minutes on, 5 off. \"{h}\" is waiting.{more}"],
    ["Exam-day you says thanks 🙏", "Tiny sessions now, no panic later."],
  ],
  language: [
    ["¿Hola? 🌍", "Your new language misses you. 5 minutes of \"{h}\"?"],
    ["Words of the day are waiting 🗣️", "Five minutes today, one less awkward pause on your trip.{more}"],
    ["Bonjour, procrastination 🥐", "Au revoir to it. \"{h}\" is still open."],
  ],
  screen: [
    ["Ironic, we know 📵", "You're reading this on your phone. Now put it down.{more}"],
    ["Your screen wants a break 📱", "From you. Give it some space tonight."],
    ["The scroll never ends. You can 🛑", "\"{h}\" counts on you. Thumbs off."],
    ["Doomscroll detected 🕵️", "Swap 15 minutes of scrolling for literally anything else."],
  ],
  junk: [
    ["The fries are calling. Don't pick up 🍟", "Ticking \"{h}\" tastes better.{more}"],
    ["Stay strong 🥗", "The snack drawer can't hurt you if you don't open it."],
    ["Cravings: 0, You: 1 💪", "Keep the score that way. \"{h}\" today."],
    ["Your gut sent a thank-you note 🙌", "It's for \"{h}\". Make it true today."],
  ],
  sleep: [
    ["Your pillow has been warming up 😴", "All day. Don't let it down. \"{h}\" tonight."],
    ["Bed > scroll 🛏️", "Your morning self is begging. Lights out on time.{more}"],
    ["Sleep is the original cheat code 🎮", "Unlock it tonight: \"{h}\"."],
    ["Bedtime story: you, on time 🌙", "The end. Sweet dreams."],
  ],
  wake: [
    ["Did you rise and shine? ☀️", "If you were up on time, tick \"{h}\". If not, tomorrow's alarm wants a rematch."],
    ["Early bird check-in 🐦", "Got the worm today? Tick \"{h}\".{more}"],
  ],
  stretch: [
    ["Your spine filed a complaint 🦴", "A few minutes of stretching settles it out of court. Then tick \"{h}\"."],
    ["Be flexible about it 🧘", "Even a few stretches count.{more}"],
    ["Reach for the sky ✋", "Then the floor. Then tick \"{h}\"."],
  ],
  workout: [
    ["Your muscles sent a ping 💪", "They're bored. \"{h}\" is still open.{more}"],
    ["10-minute delivery: endorphins 🚀", "Order's placed. You just have to show up to collect."],
    ["The couch says you're clingy 🛋️", "Give it some space. Go train."],
    ["Gains don't deliver themselves 🏋️", "No delivery partner for this one. \"{h}\" is on you."],
    ["Sweat now, flex later 😎", "\"{h}\" is waiting.{more}"],
  ],
  move: [
    ["Your shoes are judging you 👟", "They haven't left the door all day. \"{h}\"?"],
    ["Steps loading… 🚶", "Only you can finish the download.{more}"],
    ["Fresh air, zero delivery fee 🌳", "Step outside, then tick \"{h}\"."],
    ["Your playlist needs a walk 🎧", "Put it on, head out, then tick \"{h}\"."],
  ],
  mind: [
    ["Inhale. Exhale. Tick. 🌿", "\"{h}\" takes five quiet minutes.{more}"],
    ["Your thoughts are buffering 🧠", "A few slow breaths clear the cache."],
    ["Do nothing, professionally 🧘", "The one task where doing nothing counts. \"{h}\"."],
  ],
  journal: [
    ["Dear diary, it's me again ✍️", "\"{h}\" is still open. Three lines is enough."],
    ["Blank page, big potential 📝", "Write one honest sentence. Then another.{more}"],
    ["Brain dump time 🧺", "Empty your head onto the page, then tick \"{h}\"."],
  ],
  family: [
    ["Someone would love to hear from you 📞", "\"{h}\" takes five minutes and makes their day."],
    ["Family group chat ≠ quality time ❤️", "Call, don't just react.{more}"],
    ["Plot twist: you call first ☎️", "\"{h}\" is still open. They'll be glad you did."],
  ],
  plan: [
    ["Plans > panic 🗒️", "Two minutes planning saves an hour of chaos. \"{h}\"?"],
    ["Tomorrow-you wants a map 🗺️", "Jot down the top three. Done.{more}"],
  ],
  food: [
    ["Your body placed an order 🥦", "Item: \"{h}\". Delivery: you.{more}"],
    ["Eat the rainbow 🌈", "Candy doesn't count. \"{h}\" is still open."],
  ],
  clean: [
    ["Your room has a vibe. Not a good one 🧺", "Ten minutes of tidying fixes it. Then tick \"{h}\"."],
    ["Mess less, rest more ✨", "A quick sweep and \"{h}\" is done.{more}"],
  ],
  music: [
    ["Your instrument is gathering dust 🎸", "Play it something. \"{h}\" is still open."],
    ["Practice makes progress 🎶", "Fifteen minutes, one song, done.{more}"],
  ],
  care: [
    ["Self-care check ✨", "\"{h}\" is still open. Future you says thanks."],
    ["Tiny habit, big difference 🪥", "Thirty seconds for \"{h}\".{more}"],
  ],
  prayer: [
    ["A quiet moment for you 🙏", "\"{h}\" is still open today."],
    ["Pause for a moment 🕊️", "Make some time for \"{h}\".{more}"],
  ],
  any: [
    ["\"{h}\" is waiting ⏳", "It's not going to tick itself.{more}"],
    ["Tiny effort, big streak 🌱", "Start \"{h}\" now. Future you will brag about it."],
    ["Your future self says thanks 🙌", "In advance. For \"{h}\".{more}"],
    ["One tap away ✅", "Do \"{h}\", then enjoy the satisfying tick."],
    ["Psst… 👀", "\"{h}\" is still open. Quick one?{more}"],
  ],
};

/* special moments, used before the per-habit lines */
export const STREAK = [
  ["🔥 {s}-day streak on the line", "\"{h}\" is still open. Don't let it reset to zero."],
  ["Don't ghost your streak 👻", "{s} days of \"{h}\" in a row. Day {n} is one tap away."],
  ["Streak SOS 🆘", "Your {s}-day \"{h}\" streak needs you before midnight."],
  ["{s} days strong 💪", "Keep the chain going: \"{h}\" today makes it {n}."],
];
export const LAST_ONE = [
  ["So close 🏁", "Just \"{h}\" left. Finish strong and it's a perfect day."],
  ["One more and you're done 🎯", "Only \"{h}\" stands between you and a clean sweep."],
  ["Almost a perfect day ✨", "Everything's ticked except \"{h}\". You've got this."],
];
export const NONE_YET = [
  ["Zero ticks today? 👀", "Start small: \"{h}\". The rest gets easier.{more}"],
  ["Today's scoreboard: 0 📋", "Open with an easy win: \"{h}\".{more}"],
  ["Fresh start, right now 🌅", "Tick \"{h}\" and today is officially on.{more}"],
];
export const LATE = [
  ["Before the clock strikes 12 🕛", "\"{h}\" still has time. Do you?{more}"],
  ["Last call for today 🌙", "\"{h}\" closes at midnight.{more}"],
];

/* small deterministic hash, so a device gets one stable line per day but a different one tomorrow */
export function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}

const short = name => {
  const s = String(name || "").trim() || "Untitled";
  return [...s].length > 32 ? [...s].slice(0, 31).join("") + "…" : s;
};
function fill([t, b], v) {
  const f = x => x.replace(/\{h\}/g, v.h).replace(/\{s\}/g, v.s).replace(/\{n\}/g, v.n).replace(/\{more\}/g, v.more);
  return { title: f(t), body: f(b) };
}

/* morning habits make no sense to nudge about in the evening */
const MORNING = new Set(["wake", "plan"]);

/* left: today's unticked habits ({id, name}); total: today's active habits; streakOf(h): days in a row up to
   yesterday; day: local date "YYYY-MM-DD"; seed: anything stable per device (so devices differ); hour: local
   hour 0-23. Day by day it rotates through the open habits and through each habit's lines, so the same line
   doesn't come back for a while. Returns { title, body }. */
export function reminderMessage({ left, total = left.length, streakOf = () => 0, day = "", seed = "", hour = 20 }) {
  if (!left || !left.length) return { title: "All done today 🎉", body: "Every habit ticked. Go enjoy your evening." };
  const dn = /^\d{4}-\d{2}-\d{2}$/.test(day) ? Math.round(Date.parse(day + "T00:00:00Z") / 864e5) : hash(day);
  const r = hash(seed) % 997, t = dn + r; // t moves on by one every day
  const at = (list, k) => list[((k % list.length) + list.length) % list.length];
  const v = h => ({ h: short(h.name), s: 0, n: 1, more: left.length > 1 ? ` (+${left.length - 1} more)` : "" });

  // 1. a streak about to break beats everything (the longest one; 3+ days)
  let best = null, bs = 0;
  for (const h of left) { const s = +streakOf(h) || 0; if (s > bs) { bs = s; best = h } }
  if (bs >= 3) return fill(at(STREAK, t), { ...v(best), s: bs, n: bs + 1, more: "" });

  // 2. one left after a good day
  if (left.length === 1 && total >= 3) return fill(at(LAST_ONE, t), v(left[0]));

  // 3. the habit to feature today: themed ones first, no morning habits after noon
  const fits = h => !(hour >= 12 && MORNING.has(themeOf(h.name)));
  const themed = left.filter(h => fits(h) && themeOf(h.name) !== "any"), awake = left.filter(fits);
  const pool = themed.length ? themed : awake.length ? awake : left;
  const hero = at(pool, t), lines = LINES[themeOf(hero.name)], round = Math.floor(t / pool.length);

  // 4. some days, say what kind of day it is instead
  if (left.length === total && total >= 3 && t % 4 === 0) return fill(at(NONE_YET, round), v(hero));
  if (hour >= 22 && t % 3 === 0) return fill(at(LATE, round), v(hero));

  return fill(at(lines, round + r), v(hero));
}
