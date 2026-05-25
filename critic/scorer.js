/**
 * Static quality scorer — 0 to 10 scale.
 * Used as fallback when AI critic is unavailable.
 * Mirrors the 6 dimensions of the AI critic.
 */
function score(html, validationResult) {
  const { errors, warnings } = validationResult;
  let pts = 10;

  // Hard errors (-1.5 each, max -5)
  pts -= Math.min(errors.length * 1.5, 5);
  // Warnings (-0.4 each, max -2)
  pts -= Math.min(warnings.length * 0.4, 2);

  // ── Dimension bonuses ────────────────────────────────────

  // 1. Usefulness — has real content?
  if (html.length > 20000) pts += 0.3;
  if (/lorem ipsum/i.test(html)) pts -= 1.5;

  // 2. Design — CSS variables, Google Fonts, gradient
  if (/--[a-z][\w-]+\s*:/i.test(html))          pts += 0.3;
  if (/fonts\.googleapis\.com/i.test(html))      pts += 0.2;
  if (/gradient/i.test(html))                    pts += 0.2;

  // 3. Responsiveness — media queries
  const mq = (html.match(/@media\s*\(/gi)||[]).length;
  if (mq >= 3) pts += 0.5; else if (mq >= 1) pts += 0.2;
  if (/display\s*:\s*(grid|flex)/i.test(html))  pts += 0.3;

  // 4. Originality — keyframe animation variety
  const kf = (html.match(/@keyframes/gi)||[]).length;
  if (kf >= 3) pts += 0.5; else if (kf >= 1) pts += 0.2;

  // 5. Usability — interactive JS
  const ev = (html.match(/addEventListener/gi)||[]).length;
  if (ev >= 5) pts += 0.5; else if (ev >= 2) pts += 0.2;

  // 6. Performance — not bloated
  if (html.length > 80000) pts -= 0.5;

  // Semantic HTML bonus
  const sem = ['<header','<footer','<main','<section','<nav','<article']
    .filter(t => html.toLowerCase().includes(t)).length;
  pts += Math.min(sem * 0.1, 0.4);

  return Math.max(0, Math.min(10, parseFloat(pts.toFixed(1))));
}

module.exports = { score };
