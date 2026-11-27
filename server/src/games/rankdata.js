// Rank data: vocab.txt (one word per line) + ranks.bin (Uint16 LE vocab indices, TOP per target, target order).
// Words outside a target's top list get rank TOP + 1 (shown as "Far").
export function loadRankData(vocabText, ranksBuf, targets, TOP) {
  const vocab = vocabText.split('\n');
  const vocabIndex = new Map(vocab.map((w, i) => [w, i]));
  const all = new Uint16Array(ranksBuf);
  const pos = new Map(targets.map((t, i) => [t.word, i]));
  let cacheWord = null, cache = null; // one round at a time per room → cache the current target
  function getRanks(word) {
    if (word === cacheWord) return cache;
    const i = pos.get(word);
    if (i === undefined) throw new Error(`no rank data for ${word}`);
    const r = new Uint32Array(vocab.length).fill(TOP + 1);
    const top = all.subarray(i * TOP, (i + 1) * TOP);
    for (let k = 0; k < top.length; k++) r[top[k]] = k + 1;
    cacheWord = word; cache = r;
    return r;
  }
  return { vocabIndex, getRanks };
}
