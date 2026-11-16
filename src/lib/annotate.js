/**
 * Turns an answer plus a list of `{ quote, note }` annotations into text
 * segments that the UI can wrap in <mark> elements.
 *
 * The quote comes from a language model, so it is treated as a hint rather than
 * a guarantee: matching ignores case and whitespace differences, treats curly
 * and straight quotes as the same character, and falls back to the longest
 * fragment when the model inserted an ellipsis. Anything that still cannot be
 * located is returned in `unmatched` so its note is shown beside the answer
 * instead of being dropped.
 */

const EDGE_PUNCTUATION = /^[\s"'“”‘’.,;:!?…\-–—()[\]]+|[\s"'“”‘’.,;:!?…\-–—()[\]]+$/g;

function escapeWord(word) {
  return word
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/['’‘]/g, "['’‘]")
    .replace(/["“”]/g, '["“”]');
}

function locate(answer, quote) {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const pattern = new RegExp(words.map(escapeWord).join("\\s+"), "i");
  const match = pattern.exec(answer);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

/** Try the quote as given, without surrounding punctuation, then by its longest ellipsis-free piece. */
function locateTolerant(answer, quote) {
  const direct = locate(answer, quote);
  if (direct) return direct;

  const trimmed = quote.replace(EDGE_PUNCTUATION, "");
  if (trimmed && trimmed !== quote) {
    const found = locate(answer, trimmed);
    if (found) return found;
  }

  const pieces = quote
    .split(/…|\.{3}/)
    .map((piece) => piece.replace(EDGE_PUNCTUATION, ""))
    .filter((piece) => piece.length >= 12)
    .sort((a, b) => b.length - a.length);
  return pieces.length > 0 ? locate(answer, pieces[0]) : null;
}

export function annotateAnswer(answer, annotations) {
  const found = [];
  const unmatched = [];

  annotations.forEach((annotation, index) => {
    const range = answer.length > 0 ? locateTolerant(answer, annotation.quote) : null;
    if (range) found.push({ ...range, annotation: index });
    else unmatched.push(index);
  });

  // Earliest first; for equal starts keep the longer one. Overlaps keep the first range only.
  found.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const kept = [];
  let cursor = 0;
  for (const range of found) {
    if (range.start < cursor) {
      unmatched.push(range.annotation);
      continue;
    }
    kept.push(range);
    cursor = range.end;
  }

  const segments = [];
  let position = 0;
  for (const range of kept) {
    if (range.start > position) segments.push({ text: answer.slice(position, range.start), annotation: null });
    segments.push({ text: answer.slice(range.start, range.end), annotation: range.annotation });
    position = range.end;
  }
  if (position < answer.length) segments.push({ text: answer.slice(position), annotation: null });
  if (segments.length === 0) segments.push({ text: answer, annotation: null });

  return { segments, unmatched: unmatched.sort((a, b) => a - b) };
}

/** Sentences with their original punctuation, used for quoting and by the offline evaluator. */
export function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}
