"""Builds quotes.json, the "Thought of the day" collection.

Sources (every quote is attributed to the person who wrote or said it):
  * Public-domain translations of the original works, from Project Gutenberg. Only the author's own text
    is read: each book is cut at explicit start/end markers so translators' introductions, notes and
    indexes never end up attributed to the philosopher.
  * The Quotable dataset (github.com/quotable-io/data, the data behind the MIT-licensed Quotable API),
    limited to an allowlist of philosophers, sages and great writers. Quotes credited there to the
    Buddha, Laozi and Confucius are skipped (that's where most misattributed quotes live); those three
    come from the Dhammapada, the Tao Te Ching and the Analects instead.

Text rules find candidate sentences; they can't tell a profound line from one that needs its paragraph.
So every candidate is also rated 1-5 by a local model (Ollama, qwen3:8b) for "stands alone as a thought
of the day", and only 4s and 5s go on to a tournament
(see PICK below) that keeps the ones a modern reader would be gladdest to see. Ratings are cached in scripts/quote_scores.json, so a rebuild
only asks the model about new candidates; without --score it builds from the cache alone.

Usage:
  python scripts/build_quotes.py <gutenberg_dir> <quotable_quotes.json> [--score]
  <gutenberg_dir> holds <id>.txt files (plain-text UTF-8 from gutenberg.org or a mirror) for the ids below.
"""
import hashlib, json, random, re, sys, time, unicodedata, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCORES = HERE / "quote_scores.json"
KEEP = 4
OLLAMA = "http://localhost:11434/api/chat"
MODEL = "qwen3:8b"
RUBRIC = """You choose a "Thought of the day" for a habit tracker app. Rate each numbered quote from 1 to 5.
5 = profound or powerful, memorable, completely self-contained: something people would love to read each morning.
4 = a clear, self-contained insight or encouragement that reads well on its own.
3 = fine but bland, obscure, dated, or hard to understand without its source.
2 = needs its surrounding text: refers to someone or something not explained, is narrative, a historical or
    technical detail, part of an argument or a dialogue, or a fragment.
1 = not usable: broken text, offensive, sexist or demeaning, religiously preachy, or meaningless alone.
Judge only the words given. Reply with JSON only, exactly: {"s":[one integer per quote, in order]}"""
# second pass, a tournament: an 8B model grades leniently on an absolute scale but compares well, so each round
# shuffles the survivors into groups of 10 and asks for the best 5; a quote needs to win 2 of 3 rounds (1 if it got a 5)
ROUNDS, GROUP, BEST = 3, 10, 5
PICK = """You are the editor of a premium "Thought of the day" for a habit tracker. From the numbered quotes, choose the
5 that a modern reader would be most glad to see one morning: clear on first reading, memorable, wise, consoling or
motivating. Leave out anything dull, obscure, long-winded, descriptive, negative about groups of people, or needing
context. Reply with JSON only: {"best":[the 5 numbers]}"""

CATS = ["Stoic", "Mindfulness", "Realisation", "Motivating", "Wisdom"]
STOIC, MIND, REAL, MOTIV, WISE = range(5)

# id, author, work, category, start regex, end regex, mode, max quotes
BOOKS = [
    (15877, "Marcus Aurelius", "Meditations", STOIC, r"^THE THOUGHTS$", r"^INDEXES\.$", "prose", 520),
    (871, "Epictetus", "Golden Sayings", STOIC, r"^I$", r"END OF THE PROJECT GUTENBERG", "prose", 300),
    (45109, "Epictetus", "Enchiridion", STOIC, r"^\s*THE ENCHIRIDION$", r"END OF THE PROJECT GUTENBERG", "prose", 120),
    (64576, "Seneca", "Dialogues", STOIC, r"^OF ANGER\.$", r"^\s*INDEX\.$", "prose", 380),
    (56075, "Seneca", "Morals of a Happy Life", STOIC, r"^CHAPTER I\.$", r"END OF THE PROJECT GUTENBERG", "prose", 380),
    (2017, "The Buddha", "Dhammapada", MIND, r"^Chapter I\. The Twin-Verses", r"END OF THE PROJECT GUTENBERG", "verses", 400),
    (216, "Laozi", "Tao Te Ching", MIND, r"^PART 1\.$", r"^End of the Project Gutenberg", "verses", 160),
    (205, "Henry David Thoreau", "Walden", MIND, r"^Economy$", r"^ON THE DUTY OF CIVIL DISOBEDIENCE$", "prose", 260),
    (3330, "Confucius", "Analects", WISE, r"CHAPTER I\. 1\. The Master said", r"^End of Project Gutenberg", "analects", 300),
    (9105, "François de La Rochefoucauld", "Maxims", REAL, r"^1\.--What we term virtue", r"^REFLECTIONS ON VARIOUS SUBJECTS", "maxims", 520),
    (18269, "Blaise Pascal", "Pensées", REAL, r"^SECTION I$", r"^NOTES$", "prose", 300),
    (4363, "Friedrich Nietzsche", "Beyond Good and Evil", REAL, r"^CHAPTER I\. PREJUDICES", r"^FROM THE HEIGHTS$", "prose", 220),
    (10715, "Arthur Schopenhauer", "Counsels and Maxims", REAL, r"^INTRODUCTION\.$", r"END OF THE PROJECT GUTENBERG", "prose", 220),
    (2944, "Ralph Waldo Emerson", "Essays", MOTIV, r"^HISTORY$", r"END OF THE PROJECT GUTENBERG", "prose", 380),
]

# Quotable authors kept, with the category their quotes default to
QUOTABLE = {
    STOIC: ["Epictetus", "Marcus Aurelius", "Seneca the Younger", "Zeno of Citium", "Musonius Rufus", "Cato the Elder"],
    MIND: ["Thích Nhất Hạnh", "Alan Watts", "Pema Chödrön", "Eckhart Tolle", "Rumi", "Dalai Lama", "Jon Kabat-Zinn",
           "Jiddu Krishnamurti", "Ram Dass", "Kahlil Gibran", "Henry David Thoreau", "Rabindranath Tagore",
           "Shunryu Suzuki", "Swami Vivekananda", "Paramahansa Yogananda", "Hafez", "Lao Tzu", "Chuang Tzu", "Zhuangzi",
           "Daisaku Ikeda", "Sri Chinmoy"],
    REAL: ["Friedrich Nietzsche", "Blaise Pascal", "François de La Rochefoucauld", "Søren Kierkegaard", "Albert Camus",
           "Jean-Paul Sartre", "Carl Jung", "Arthur Schopenhauer", "Voltaire", "Michel de Montaigne", "Oscar Wilde",
           "Leo Tolstoy", "Fyodor Dostoevsky", "Bernard Shaw", "George Bernard Shaw", "Bertrand Russell", "Aldous Huxley",
           "Henri-Frédéric Amiel", "Publilius Syrus", "Heraclitus", "William James", "Mark Twain", "Anaïs Nin",
           "Simone de Beauvoir", "Baruch Spinoza", "Immanuel Kant", "René Descartes", "Thomas Carlyle", "Samuel Johnson",
           "Francis Bacon", "Montesquieu", "George Santayana", "Henri Bergson", "Anatole France", "Jean-Jacques Rousseau",
           "David Hume", "John Stuart Mill", "Ludwig Wittgenstein", "Martin Heidegger", "Erich Fromm", "Viktor Frankl",
           "Alexander Pope", "Jonathan Swift", "George Eliot", "Robert M. Pirsig", "Joseph Campbell", "Hermann Hesse",
           "Franz Kafka", "Antoine de Saint-Exupéry", "Ludwig van Beethoven", "Sigmund Freud", "Epicurus", "Diogenes"],
    MOTIV: ["Ralph Waldo Emerson", "Johann Wolfgang von Goethe", "Helen Keller", "Eleanor Roosevelt", "Mahatma Gandhi",
            "Martin Luther King Jr.", "Nelson Mandela", "Theodore Roosevelt", "Abraham Lincoln", "Benjamin Franklin",
            "Maya Angelou", "Mother Teresa", "Albert Schweitzer", "Elbert Hubbard", "Bruce Lee", "Ovid", "Virgil", "Horace",
            "Thomas Edison", "Winston Churchill", "Leonardo da Vinci", "Michelangelo", "Robert Louis Stevenson",
            "Henry Wadsworth Longfellow", "Walt Whitman", "Victor Hugo", "Napoleon", "William Ellery Channing",
            "Orison Swett Marden", "Samuel Smiles", "Booker T. Washington", "Frederick Douglass", "Marie Curie"],
    WISE: ["Aristotle", "Plato", "Socrates", "Cicero", "Plutarch", "Sophocles", "Euripides", "Aeschylus", "Aesop",
           "Isocrates", "Sun Tzu", "Chanakya", "Augustine of Hippo", "Thomas Aquinas", "William Shakespeare",
           "Thomas Jefferson", "Benjamin Disraeli", "John Locke", "Pythagoras", "Democritus", "Thales", "Solon",
           "Seneca", "Lucretius", "Juvenal", "Menander", "Herodotus", "Thucydides", "Dante Alighieri", "Thomas Paine",
           "Alexis de Tocqueville", "Baltasar Gracián", "Erasmus", "Thomas à Kempis", "John Milton", "William Blake",
           "Charles Dickens", "Ralph Waldo Trine", "Leo Buscaglia", "Plotinus", "Jerome", "Ambrose Bierce", "Mencius"],
}
QUOTABLE_TAG_CAT = {"Inspirational": MOTIV, "Motivational": MOTIV, "Success": MOTIV, "Courage": MOTIV, "Change": MOTIV,
                    "Self Help": MOTIV, "Spirituality": MIND, "Happiness": MIND, "Truth": REAL, "Self": REAL}
QUOTABLE_SKIP_TAGS = {"Technology", "Sports", "Competition", "Business", "Film", "Humorous", "Politics", "War", "Power Quotes"}
STOIC_SOURCE_NAMES = {"Seneca the Younger": "Seneca"}  # one name per person in the app

KEYWORDS = set("""life live lives living death die dies mind minds soul souls heart happiness happy unhappy virtue virtues wise wisdom
fool fools folly fear fears anger angry desire desires pleasure pleasures pain pains time present future past nature good evil
truth true false patience patient courage brave strength strong weak character habit habits work labour labor duty reason
peace calm quiet silence silent stillness joy sorrow grief suffering love hate hatred friend friends friendship man men mankind
self yourself thyself himself myself thou thee thy thine you we our us never always nothing everything every whoever whatever
fortune fate free freedom slave learn learning knowledge know ignorance thought thoughts thinking thinks mindful attention
watchful vigilant wealth rich poor poverty contentment content greatness great noble honour honor shame vanity pride humble
humility dream dreams hope hopes act action actions deed deeds today tomorrow day days moment moments world universe
character opinion opinions judgment judgement sleep awake meditation calmness simplicity simple trust faith genius success
failure effort persevere perseverance discipline master conquer conquers victory""".split())
BAD_START = set("""this that these those he she they it its his her their him them such thus hence therefore here there then again also
moreover nor wherefore which whence but and or for so yet now accordingly besides further furthermore however indeed
nevertheless otherwise rather still whereas while who whom whose where when what likewise lastly first secondly thirdly
finally above below see cf whereupon wherein thereupon""".split())
BAD_WORDS = re.compile(r"\b(chapter|book|books|verse|verses|said|says|replied|asked|answered|translat\w*|edition|author|"
                       r"reader|readers|aforesaid|former|latter|mentioned|following|above|below|section|passage|note|notes|"
                       r"page|treatise|letter|essay|dialogue|novatus|lucilius|serenus|paulinus|marcia|helvia|polybius|"
                       r"nero|caesar|gallio|liberalis|aebutius|bhikshu|bhikkhu|brahmana|brahmanas|tathagata|ye|yea|"
                       r"lo|behold|verily)\b", re.I)
GENERIC_SUBJECT = re.compile(r"\b(he who|him who|she who|they who|those who|the man who|a man|no man|every man|whoever|"
                             r"one who|men|people|mankind|a wise man|the wise|the fool|the good man|the superior man)\b", re.I)
PRONOUN = re.compile(r"\b(he|his|him|she|her|hers|they|them|their)\b", re.I)
ALLOWED_CAPS = set("""I God Gods Nature Tao Heaven Earth Fortune Providence Truth Reason Destiny Fate Universe Buddha Love
Virtue Wisdom Death Time Life O Mind Self Way Sage Master Zeus""".split())


def norm_key(s):
    s = unicodedata.normalize("NFKD", s.lower())
    return re.sub(r"[^a-z]", "", s)


def tidy(s):
    s = s.replace(" ", " ")
    s = re.sub(r"\[(?:Footnote|Greek)[^\]]*\]", "", s)
    s = re.sub(r"\[[A-Z0-9]{1,3}\]", "", s)          # [A], [12] footnote marks
    s = re.sub(r"\([^)]*\d[^)]*\)", "", s)            # (iii. 7; vi. 23) cross references
    s = re.sub(r"[\[\]()]", "", s)                    # translator insertions keep their words
    s = s.replace("_", "").replace("--", "—").replace("—", " — ")
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s+([,.;:!?])", r"\1", s)
    s = re.sub(r" — ([.,;:!?])", r"\1", s)
    s = re.sub(r"\s*—\s*", " — ", s).replace("  ", " ")
    return s


def strip_lead(s):
    s = re.sub(r"^(?:Ch\. \d+\. )?(?:\d+|[IVXLC]+)\.\s*(?:—\s*)?(?:\d+\.\s*)?", "", s).strip()
    m = re.match(r"^(But|And|For|So|Yet|Now|Therefore|Thus|Hence)\s*,?\s+(.)", s)
    if m:  # a saying that starts "But he who..." stands on its own without the joining word
        s = m.group(2).upper() + s[m.end():]
    return s


def ok(s, strict, lo=40, hi=200):
    if not (lo <= len(s) <= hi): return False
    if not re.match(r"^[“\"‘']?[A-Z]", s) or not re.search(r"[.!?][”\"’']?$", s): return False
    if re.search(r"[0-9_\[\]{}|*=<>/\\]|Greek|http|Gutenberg|&", s): return False
    if s.count('"') % 2 or s.count("“") != s.count("”"): return False
    if s.count("‘") != s.count("’") and not re.search(r"\w’\w", s): return False
    if s.rstrip("”\"’'").endswith(":") or s.count(";") > 2: return False
    if BAD_WORDS.search(s): return False
    words = re.findall(r"[A-Za-z’']+", s)
    if not words or words[0].lower().strip("’'") in BAD_START: return False
    caps = [w for w in words[1:] if w[0].isupper() and w.strip("’'s") not in ALLOWED_CAPS]
    if len(caps) > (1 if strict else 2): return False   # names and places mean an anecdote that needs context
    if strict and PRONOUN.search(s) and not GENERIC_SUBJECT.search(s): return False
    if strict and not any(w.lower() in KEYWORDS for w in words): return False
    return True


def score(s):
    words = [w.lower() for w in re.findall(r"[A-Za-z]+", s)]
    k = sum(w in KEYWORDS for w in words)
    sc = k * 2 + (3 if GENERIC_SUBJECT.search(s) else 0) + (2 if re.search(r"\b(never|always|no one|nothing|every)\b", s, re.I) else 0)
    sc -= max(0, len(s) - 150) / 25
    sc -= 2 * len(re.findall(r"\b(thee|thou|thy|thine|hath|doth|art|shalt|wilt|canst|dost)\b", s, re.I)) / max(1, len(words) / 12)
    return sc


def section(text, start, end):
    lines = text.replace("\r", "").split("\n")
    a = next(i for i, l in enumerate(lines) if re.search(start, l))
    b = next((i for i, l in enumerate(lines) if i > a and re.search(end, l)), len(lines))
    return lines[a:b]


def paragraphs(lines, skip_indented):
    out, cur = [], []
    for l in lines:
        if skip_indented and re.match(r"^ {4,}\S", l) and not re.match(r"^\s*[IVXLC]+$", l):
            continue
        l = re.sub(r"\s{3,}\d+\s*$", "", l)
        if not l.strip():
            if cur: out.append(" ".join(cur)); cur = []
        else:
            cur.append(l.strip())
    if cur: out.append(" ".join(cur))
    return out


SENT_SPLIT = re.compile(r"(?<=[.!?])[”\"’']?\s+(?=[“\"‘']?[A-Z])")


def sentences(par):
    par = tidy(par)
    out = []
    for s in SENT_SPLIT.split(par):
        s = s.strip()
        if s.count("“") > s.count("”"): s = s.lstrip("“")
        if s.count("”") > s.count("“"): s = s.rstrip("”")
        out.append(s)
    return out


def from_book(gut, bid, start, end, mode):
    text = (gut / f"{bid}.txt").read_text(encoding="utf-8", errors="replace").lstrip("﻿")
    block = "\n".join(section(text, start, end))
    for _ in range(2):  # square brackets hold translators' notes and insertions, never the author's words
        block = re.sub(r"\[[^\[\]]*\]", "", block)
    lines = block.split("\n")
    found = []  # (text, score)
    if mode == "analects":
        body = tidy(" ".join(l.strip() for l in lines))
        for m in re.finditer(r"The Master said, '(.+?)'(?=\s+(?:CHAP\.|\d+\.|BOOK|$))", body):
            s = m.group(1).strip()
            s = s[0].upper() + s[1:]
            if ok(s, False, 30, 210):
                found.append((s, score(s) + 3))
        return found
    if mode in ("verses", "maxims"):
        units, cur = [], []
        head = re.compile(r"^(?:Ch\. \d+\. )?\d+\.\s|^\d+\.--|^[IVXLC]+\.--")
        for l in lines:
            if head.match(l.strip()) and cur:
                units.append(" ".join(cur)); cur = []
            if l.strip(): cur.append(l.strip())
            elif cur and mode == "maxims": units.append(" ".join(cur)); cur = []
        if cur: units.append(" ".join(cur))
        for u in units:
            s = strip_lead(tidy(u))
            if ok(s, False, 30, 230):
                found.append((s, score(s) + 4))  # a whole saying beats a sentence cut from one
            elif len(s) > 230:
                for x in sentences(s):
                    x = strip_lead(x)
                    if ok(x, True): found.append((x, score(x)))
        return found
    for p in paragraphs(lines, skip_indented=True):
        for s in sentences(p):
            s = strip_lead(s)
            if ok(s, True): found.append((s, score(s)))
    return found


def hkey(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


def rate(batch, rubric=RUBRIC, top=5):
    msg = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(batch))
    body = json.dumps({"model": MODEL, "stream": False, "think": False, "format": "json",
                       "options": {"num_ctx": 8192, "temperature": 0},
                       "messages": [{"role": "system", "content": rubric}, {"role": "user", "content": msg}]}).encode()
    req = urllib.request.Request(OLLAMA, body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        out = json.loads(json.loads(r.read())["message"]["content"])["s"]
    if len(out) != len(batch) or not all(isinstance(x, int) and 1 <= x <= top for x in out):
        raise ValueError(f"bad ratings {out}")
    return out


def pick(batch):
    msg = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(batch))
    body = json.dumps({"model": MODEL, "stream": False, "think": False, "format": "json",
                       "options": {"num_ctx": 8192, "temperature": 0},
                       "messages": [{"role": "system", "content": PICK}, {"role": "user", "content": msg}]}).encode()
    req = urllib.request.Request(OLLAMA, body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        best = json.loads(json.loads(r.read())["message"]["content"])["best"]
    best = {x for x in best if isinstance(x, int) and 1 <= x <= len(batch)}
    if not (BEST - 1 <= len(best) <= BEST + 1): raise ValueError(f"bad picks {best}")
    return best


def tournament(texts, cache):
    texts = list(dict.fromkeys(texts))
    for rnd in range(ROUNDS):
        pre = f"p{rnd}:"
        if all(pre + hkey(t) in cache for t in texts): continue
        order = texts[:]; random.Random(100 + rnd).shuffle(order)
        print(f"round {rnd + 1}: {len(order)} quotes", flush=True)
        t0 = time.time()
        for i in range(0, len(order), GROUP):
            g = order[i:i + GROUP]
            if all(pre + hkey(t) in cache for t in g): continue
            for attempt in range(3):
                try:
                    best = pick(g) if len(g) > BEST else set(range(1, len(g) + 1))
                    for j, t in enumerate(g): cache[pre + hkey(t)] = int(j + 1 in best)
                    break
                except Exception as e:
                    print("  retry:", e, flush=True)
            if i // GROUP % 40 == 0:
                SCORES.write_text(json.dumps(cache, sort_keys=True, indent=0), encoding="utf-8")
                print(f"  {i + len(g)}/{len(order)}  {time.time() - t0:.0f}s", flush=True)
        SCORES.write_text(json.dumps(cache, sort_keys=True, indent=0), encoding="utf-8")


def wins(cache, t):
    return sum(cache.get(f"p{r}:" + hkey(t), 0) for r in range(ROUNDS))


def score_all(texts, cache, rubric=RUBRIC, top=5, prefix="", size=12):
    todo = [t for t in dict.fromkeys(texts) if prefix + hkey(t) not in cache]
    random.Random(7).shuffle(todo)  # mixed books in every batch, so the model judges each line on its own
    print(f"rating {len(todo)} new candidates with {MODEL}", flush=True)
    t0 = time.time()
    for i in range(0, len(todo), size):
        batch = todo[i:i + size]
        for attempt in range(3):
            try:
                for t, s in zip(batch, rate(batch, rubric, top)): cache[prefix + hkey(t)] = s
                break
            except Exception as e:
                print("  retry:", e, flush=True)
        if i // size % 10 == 0:
            SCORES.write_text(json.dumps(cache, sort_keys=True, indent=0), encoding="utf-8")
            print(f"  {i + len(batch)}/{len(todo)}  {time.time() - t0:.0f}s", flush=True)
    SCORES.write_text(json.dumps(cache, sort_keys=True, indent=0), encoding="utf-8")


def clean(text):
    return re.sub(r"\s+", " ", text).strip().replace("'", "’").replace(" ’", " ‘").replace("(’", "(‘")


def build(gut, quotable_path, do_score):
    seen, rows, srcs = set(), [], []
    cache = json.loads(SCORES.read_text(encoding="utf-8")) if SCORES.exists() else {}

    def src_idx(author, work):
        key = [author, work]
        if key not in srcs: srcs.append(key)
        return srcs.index(key)

    def add(text, author, work, cat):
        base = cache.get(hkey(text), 0)
        if base < KEEP or wins(cache, text) < (1 if base == 5 else 2): return False
        k = norm_key(text)
        if len(k) < 20 or k in seen: return False
        seen.add(k)
        if re.fullmatch(r"[“\"‘][^“”\"]+[”\"’]", text): text = text[1:-1]  # the page adds its own quote marks
        rows.append([text, src_idx(author, work), cat, base + wins(cache, text)])  # quality is dropped after ordering
        return True

    books = []
    for bid, author, work, cat, start, end, mode, cap in BOOKS:
        found = sorted(from_book(gut, bid, start, end, mode), key=lambda x: -x[1])
        books.append(([clean(s) for s, _ in found], author, work, cat, cap))

    owner = {a: c for c, names in QUOTABLE.items() for a in names}
    picked = []
    for x in json.loads(Path(quotable_path).read_text(encoding="utf-8")):
        a = x["author"]
        if a not in owner or QUOTABLE_SKIP_TAGS & set(x["tags"]): continue
        cat = owner[a]
        if cat in (WISE, REAL):
            cat = next((QUOTABLE_TAG_CAT[t] for t in x["tags"] if t in QUOTABLE_TAG_CAT), cat)
        text = clean(x["content"])
        if 20 <= len(text) <= 220: picked.append((text, STOIC_SOURCE_NAMES.get(a, a), cat))

    if do_score:
        every = [t for b in books for t in b[0]] + [p[0] for p in picked]
        score_all(every, cache)
        tournament([t for t in every if cache.get(hkey(t), 0) >= KEEP], cache)

    report = []
    for found, author, work, cat, cap in books:
        # best rated first, then the text rules' order; cap keeps one long book from crowding out the rest
        order = sorted(range(len(found)), key=lambda i: (-wins(cache, found[i]), -cache.get(hkey(found[i]), 0), i))
        n = 0
        for i in order:
            if n >= cap: break
            n += add(found[i], author, work, cat)
        report.append((author, work, len(found), n))

    n = sum(add(t, a, "", c) for t, a, c in picked)
    report.append(("Quotable", "(allowlisted authors)", len(picked), n))
    return rows, srcs, report


def day_order(rows, seed=20261127):
    """One thought per day: categories take turns in proportion to their size, never the same one twice in a row."""
    rnd = random.Random(seed)
    by = {c: [r for r in rows if r[2] == c] for c in range(len(CATS))}
    for c in by:  # shuffled, but the very best lean towards the front, so the first months make a strong impression
        by[c].sort(key=lambda r: rnd.random() + (0 if r[3] >= 8 else 0.4))
    total = {c: len(v) for c, v in by.items()}
    used = {c: 0 for c in by}
    out, prev = [], None
    while len(out) < len(rows):
        options = [c for c in by if used[c] < total[c]]
        pick = [c for c in options if c != prev] or options
        c = min(pick, key=lambda c: (used[c] + 1) / total[c])
        out.append(by[c][used[c]]); used[c] += 1; prev = c
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    gut, quotable = Path(sys.argv[1]), sys.argv[2]
    rows, srcs, report = build(gut, quotable, "--score" in sys.argv)
    rows = [r[:3] for r in day_order(rows)]
    out = {"v": 1, "cats": CATS, "src": srcs, "q": rows}
    root = Path(__file__).resolve().parent.parent
    (root / "quotes.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for a, w, f, n in report: print(f"{n:5} of {f:5}  {a} {w}")
    print("total", len(rows), {CATS[c]: sum(r[2] == c for r in rows) for c in range(len(CATS))})


if __name__ == "__main__":
    main()
