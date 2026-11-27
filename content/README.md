# Content

`words.csv` is the single source of truth for game content. Only rows with `teacher_approved=yes` are built into the game.

Columns: id, word, context (en|fr|ru|ko|zh), cefr, category, clue_text (≤3 words), emoji1–3 (OpenMoji hexcodes), culture_note_en, culture_note_th, contexto (yes|no|pending), teacher_approved (yes|no), dictionary_checked (cambridge|oxford|-).

Notes on draft v1 (27 Nov 2026, drafted by Claude):
- CEFR levels are Claude's estimates. They have NOT been checked against English Vocabulary Profile or the Oxford 3000/5000.
- `dictionary_checked` is `-` for every row: no row has yet been checked against Cambridge or Oxford.
- All clues and culture notes were written from scratch; no dictionary definitions were copied.
- `contexto=pending` until tools/build_ranks.py checks each word's nearest neighbours.
- Emoji: OpenMoji (CC BY-SA 4.0), all hexcodes validated against openmoji.json by tools/check_words.py.
