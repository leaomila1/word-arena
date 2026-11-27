"""Validate content/words.csv. Usage: python3 tools/check_words.py [openmoji.json]"""
import csv, json, sys, collections, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
rows = list(csv.DictReader(open(root / 'content/words.csv', encoding='utf-8')))
errs = []
moji = {e['hexcode'] for e in json.load(open(sys.argv[1]))} if len(sys.argv) > 1 else None
if len(rows) != 100: errs.append(f'rows={len(rows)} (want 100)')
per = collections.Counter(r['context'] for r in rows)
for c in ['en', 'fr', 'ru', 'ko', 'zh']:
    if per[c] != 20: errs.append(f'{c}: {per[c]} rows (want 20)')
dups = [w for w, n in collections.Counter(r['word'].lower() for r in rows).items() if n > 1]
if dups: errs.append(f'duplicate words: {dups}')
for r in rows:
    if len(r['clue_text'].split()) > 3: errs.append(f"{r['id']}: clue >3 words")
    if r['word'].lower() in r['clue_text'].lower(): errs.append(f"{r['id']}: clue contains answer")
    if r['cefr'] not in ('A2', 'B1'): errs.append(f"{r['id']}: cefr {r['cefr']}")
    if not r['culture_note_en'] or not r['culture_note_th']: errs.append(f"{r['id']}: missing note")
    if moji is not None:
        for k in ('emoji1', 'emoji2', 'emoji3'):
            if r[k] not in moji: errs.append(f"{r['id']}: {k} {r[k]} not in OpenMoji")
for c in per:
    cats = {r['category'] for r in rows if r['context'] == c}
    if len(cats) < 4: errs.append(f'{c}: only {len(cats)} categories')
print('\n'.join(errs) if errs else 'OK: all checks passed')
sys.exit(1 if errs else 0)
