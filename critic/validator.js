/**
 * Validates generated HTML for common issues.
 * Returns { errors[], warnings[] }
 */
function validate(html) {
  const errors   = [];
  const warnings = [];

  if (!html || typeof html !== 'string') {
    errors.push('HTML is empty or not a string.');
    return { errors, warnings };
  }

  // ── Critical checks (errors) ─────────────────────────────────
  if (!html.includes('<!DOCTYPE') && !html.includes('<!doctype'))
    errors.push('Missing DOCTYPE declaration.');

  if (!/<html[\s>]/i.test(html))
    errors.push('Missing <html> tag.');

  if (!/<head[\s>]/i.test(html))
    errors.push('Missing <head> section.');

  if (!/<body[\s>]/i.test(html))
    errors.push('Missing <body> section.');

  if (!/<title[\s>]/i.test(html))
    errors.push('Missing <title> tag.');

  if (!/<meta\s+charset/i.test(html))
    errors.push('Missing charset meta tag.');

  if (!/<meta\s+name="viewport/i.test(html))
    errors.push('Missing viewport meta tag (not mobile-responsive).');

  // Unclosed script/style tags
  const scriptOpens  = (html.match(/<script/gi)  || []).length;
  const scriptCloses = (html.match(/<\/script>/gi) || []).length;
  if (scriptOpens !== scriptCloses)
    errors.push(`Mismatched <script> tags (${scriptOpens} open, ${scriptCloses} close).`);

  const styleOpens  = (html.match(/<style/gi)  || []).length;
  const styleCloses = (html.match(/<\/style>/gi) || []).length;
  if (styleOpens !== styleCloses)
    errors.push(`Mismatched <style> tags (${styleOpens} open, ${styleCloses} close).`);

  // Lorem ipsum detection
  if (/lorem ipsum/i.test(html))
    errors.push('Lorem ipsum placeholder text detected.');

  // External dependencies that could break offline
  const externalScripts = html.match(/<script\s+src="(?!https:\/\/fonts\.googleapis)/gi) || [];
  if (externalScripts.length > 0)
    warnings.push(`${externalScripts.length} external script(s) — may fail if CDN unavailable.`);

  // ── Quality checks (warnings) ────────────────────────────────
  if (html.length < 5000)
    warnings.push('HTML seems very short for a full site (<5KB).');

  if (!/<nav[\s>]/i.test(html) && !html.toLowerCase().includes('navigation'))
    warnings.push('No <nav> element detected — navigation may be missing.');

  if (!/<h1[\s>]/i.test(html))
    warnings.push('No <h1> heading found — poor SEO/accessibility.');

  if (!/@keyframes|animation:|transition:/i.test(html))
    warnings.push('No CSS animations or transitions detected — site may feel static.');

  if (!/@media\s*\(/i.test(html))
    warnings.push('No CSS media queries — site may not be responsive.');

  if (!/addEventListener|onclick|onsubmit/i.test(html))
    warnings.push('No JS event listeners detected — site may be non-interactive.');

  if (!/<meta\s+name="description/i.test(html))
    warnings.push('Missing meta description tag (SEO).');

  // Placeholder src/href checks
  if (/src=["']#["']/i.test(html) || /href=["']#["']/i.test(html))
    warnings.push('Placeholder links (#) detected — may look unfinished.');

  return { errors, warnings };
}

module.exports = { validate };
