/** Uniform integer selection. Rejection sampling avoids modulo bias. */
export function randomIndex(length: number): number {
  if (!Number.isInteger(length) || length < 1 || length > 0x100000000) {
    throw new RangeError("Expected a positive participant count.");
  }
  const limit = Math.floor(0x100000000 / length) * length;
  const word = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(word);
  } while (word[0] >= limit);
  return word[0] % length;
}
