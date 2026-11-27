// Nickname rules: 1–16 chars after trim, no profanity (checked after leetspeak normalisation).
export const MAX_NAME = 16;

// Matched anywhere inside the name.
const EMBEDDED = ['fuck', 'shit', 'cunt', 'bitch', 'asshole', 'dick', 'pussy', 'nigg', 'fag', 'whore', 'slut', 'porn', 'kuay'];
// Matched only as a whole word (too many innocent words contain them, e.g. "glass").
const WHOLE = ['ass', 'cum', 'tit', 'tits', 'damn', 'hell', 'sex', 'hee', 'yed'];

// Thai-script profanity, matched anywhere (Thai has no spaces between words).
const THAI = ['ควย', 'เหี้ย', 'เย็ด', 'สัส', 'สัด', 'แตด', 'กระดอ', 'จัญไร', 'ระยำ', 'ชิบหาย', 'เงี่ยน', 'ส้นตีน'];
// Cyrillic letters that look like Latin ones (fuсk with a Cyrillic с).
const HOMO = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'і': 'i', 'ѕ': 's', 'ԁ': 'd', 'ո': 'n', 'ս': 'u' };

const LEET = { '@': 'a', '4': 'a', '$': 's', '5': 's', '0': 'o', '1': 'i', '!': 'i', '3': 'e', '7': 't' };

export function normalise(s) {
  return s.toLowerCase().replace(/[аеорсухкіѕԁոս]/g, c => HOMO[c]).replace(/[@4$50!137]/g, c => LEET[c]);
}

export function validateName(raw) {
  const name = String(raw ?? '').replace(/\p{Cf}/gu, '').trim();
  if (!name) return { ok: false, reason: 'EMPTY' };
  if ([...name].length > MAX_NAME) return { ok: false, reason: 'TOO_LONG' };
  const thai = name.replace(/\s+/g, '');
  if (THAI.some(w => thai.includes(w))) return { ok: false, reason: 'PROFANITY' };
  const n = normalise(name);
  const squashed = n.replace(/[^a-z]/g, '');
  if (EMBEDDED.some(w => squashed.includes(w))) return { ok: false, reason: 'PROFANITY' };
  const words = n.split(/[^a-z]+/);
  if (words.some(w => WHOLE.includes(w))) return { ok: false, reason: 'PROFANITY' };
  return { ok: true, name };
}
