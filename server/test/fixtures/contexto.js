// Tiny rank fixture: 5-word vocab, one target "cat".
const vocab = ['cat', 'kitten', 'dog', 'car', 'table'];
export const fixture = {
  vocabIndex: new Map(vocab.map((w, i) => [w, i])),
  targets: [
    { id: 'en-01', word: 'cat', context: 'en', culture_note_en: 'n-en', culture_note_th: 'n-th' },
    { id: 'ko-01', word: 'dog', context: 'ko', culture_note_en: 'x', culture_note_th: 'y' },
  ],
  ranks: { cat: Uint32Array.from([1, 2, 3, 1600, 400]), dog: Uint32Array.from([3, 4, 1, 2, 5]) },
};
export const getRanks = (word) => fixture.ranks[word];
