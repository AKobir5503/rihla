// Answer matching: clean up the text, then find the bank entry it means,
// tolerating typos and transliteration differences. Runs instantly in the browser.

const HONORIFICS = /\b(saw|saws|pbuh|ra|as|swt|rh|radiallahu anhu|alayhis salam)\b|[ﷺﷻ]/g;

export function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "") // strip accents
    .replace(HONORIFICS, " ")
    .replace(/['’`ʿʾ\-_.(),!?"]/g, " ")
    .replace(/\b(al|el|ul|an|ar|as|at|ad|az|ash|the)\s+/g, "") // drop leading articles
    .replace(/\bbin\b|\bibn\b/g, "ibn")
    .replace(/ou/g, "u").replace(/ee/g, "i").replace(/oo/g, "u").replace(/aa/g, "a")
    .replace(/[^a-z0-9؀-ۿ ]/g, "")
    .replace(/\s+/g, "") // spaces don't matter: "abu bakr" == "abubakr"
    .trim();
}

function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// Every spelling an answer can be typed as.
function forms(answer) {
  return [answer.text, ...(answer.aliases || [])].map(normalize).filter(Boolean);
}

// Returns { answer, exact } or null. `answers` = the question's bank.
// Silent autocorrect: snaps what was typed to the closest answer when it's clearly that one.
export function matchAnswer(input, answers) {
  const n = normalize(input);
  if (!n) return null;
  for (const a of answers) if (forms(a).includes(n)) return { answer: a, exact: true };

  const unique = (pred) => {
    const hits = answers.filter((a) => forms(a).some(pred));
    return hits.length === 1 ? { answer: hits[0], exact: false } : null;
  };

  // 1) Typos: ~1 edit per 4 characters (max 3), single clear winner.
  const max = Math.min(3, Math.floor(n.length / 4));
  if (max > 0) {
    let best = null, bestD = max + 1, tie = false;
    for (const a of answers) {
      for (const f of forms(a)) {
        const d = editDistance(n, f, max);
        if (d < bestD) { best = a; bestD = d; tie = false; }
        else if (d === bestD && best && best !== a) tie = true;
      }
    }
    if (best && bestD <= max && !tie) return { answer: best, exact: false };
  }
  // 2) Started typing a longer name ("kende" -> Kendeda Building).
  if (n.length >= 4) { const m = unique((f) => f.startsWith(n)); if (m) return m; }
  // 3) Typed a distinctive part of it ("waqqas" -> Sa'd ibn Abi Waqqas).
  if (n.length >= 5) { const m = unique((f) => f.includes(n)); if (m) return m; }
  return null;
}
