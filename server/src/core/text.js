// Lowercase, strip accents (crêpe → crepe), collapse whitespace.
export const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
