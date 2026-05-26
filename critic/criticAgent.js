const { callAI, extractJSON } = require('../backend/openrouter');
const { validate }            = require('./validator');
const { repair }              = require('./repairAgent');

// ── Scoring thresholds (0–10 scale) ──────────────────────
const SCORE_DEPLOY  = 5;   // 5-10 → deploy
const SCORE_REPAIR  = 3;   // 3-4  → attempt repair
const SCORE_REJECT  = 3;   // <3   → reject
const MAX_REPAIRS   = 0;   // handled by generator.js now

// ── Critic system prompt ──────────────────────────────────
const CRITIC_SYSTEM = `You are the critic AI inside an autonomous AI web tool generation platform.

Your job is to review generated web tools and aggressively detect weak, broken, repetitive, ugly, or useless outputs before deployment.

You are NOT here to be positive. You are here to protect quality.

The generated tool must:
• solve a real problem
• function correctly
• look modern
• work on mobile
• feel polished
• be deployable

CHECK FOR:

USEFULNESS:
• does the tool solve a real daily problem?
• is the purpose obvious?
• is the tool genuinely usable?
Reject: pointless tools, fake websites, empty pages, useless decorative layouts

UI QUALITY:
Check: spacing, typography, alignment, layout balance, visual hierarchy
Reject: ugly layouts, cluttered UI, inconsistent spacing, broken alignment

RESPONSIVENESS:
Check: mobile layout, tablet layout, overflow issues, scaling issues
Reject: broken mobile UI, overlapping sections, horizontal scrolling

INTERACTIVITY:
Check: buttons work, forms work, JavaScript functions correctly, animations function properly
Reject: fake buttons, broken interactions, dead UI

CODE QUALITY:
Check: valid HTML, valid CSS, valid JavaScript
Reject: syntax errors, console errors, broken scripts, invalid structure

API VALIDATION:
Check: free APIs function correctly, fetch requests work, loading states exist, API errors are handled
Reject: broken API integration, missing error handling, invalid API usage

ORIGINALITY:
Check: repeated layouts, repeated color systems, repeated structures
Reject: cloned outputs, repetitive designs, template spam

PERFORMANCE:
Reject: excessive animations, laggy rendering, bloated JavaScript, unnecessary complexity

ACCESSIBILITY:
Check: readable contrast, semantic HTML, readable typography, visible buttons

FREE API RULES:
Allowed APIs: weather, quotes, dictionary, currency, country, cat/dog images, memes, astronomy, recipes, crypto, jokes, space, GitHub public data
API rules: must be free, browser-accessible, no backend auth, includes error handling and loading states, gracefully fails

SCORING DIMENSIONS:
Rate each 0–10:
• usefulness
• design
• responsiveness
• originality
• usability
• performance

FINAL SCORE: 0 to 10 (average of dimensions)
• 9 to 10 = excellent
• 8 to 9  = deploy
• 6 to 7  = needs repair
• below 6 = reject

Reply ONLY with valid JSON, no markdown:
{
  "score": <0-10 number>,
  "verdict": "deploy" | "repair" | "reject",
  "dimensions": {"usefulness":0,"design":0,"responsiveness":0,"originality":0,"usability":0,"performance":0},
  "issues": ["list of specific issues found"],
  "repairs": ["specific fixes needed"],
  "reason": "one sentence verdict summary"
}`;

// ── Run AI critique ───────────────────────────────────────
async function runAICritic(html, idea) {
  const user = `Site idea: "${idea}"

HTML to review (first 10000 chars):
${html.slice(0, 10000)}`;

  const raw    = await callAI(CRITIC_SYSTEM, user, 1024);
  const result = extractJSON(raw);

  // Normalise score to 0-10
  if (typeof result.score !== 'number') result.score = 5;
  result.score = Math.max(0, Math.min(10, Number(result.score.toFixed(1))));

  // Derive verdict from score if missing
  if (!result.verdict) {
    result.verdict = result.score >= SCORE_DEPLOY ? 'deploy'
                   : result.score >= SCORE_REPAIR ? 'repair'
                   : 'reject';
  }

  result.issues  = result.issues  || [];
  result.repairs = result.repairs || [];
  result.dimensions = result.dimensions || {};

  return result;
}

// ── Main critic pipeline ──────────────────────────────────
/**
 * Runs full critic pipeline: static validation + AI critique + optional repair.
 * Returns { html, score, verdict, critique, repairCount, rejected }
 */
async function criticAndRepair(html, idea) {
  console.log(`[Critic] 🔍 Starting critique for: "${idea}"`);

  // 1. Static structural validation first (fast, no AI cost)
  const validation = validate(html);
  if (validation.errors.length > 0) {
    console.warn(`[Critic] ⚠️  Static validation found ${validation.errors.length} errors`);
  }

  // 2. AI critique
  let critique;
  try {
    critique = await runAICritic(html, idea);
  } catch (err) {
    console.warn(`[Critic] ⚠️  AI critique failed (${err.message}) — using static score only`);
    // Fallback to static score
    const staticScore = Math.max(1, 10 - validation.errors.length * 1.5 - validation.warnings.length * 0.5);
    critique = {
      score:    parseFloat(staticScore.toFixed(1)),
      verdict:  staticScore >= SCORE_DEPLOY ? 'deploy' : staticScore >= SCORE_REPAIR ? 'repair' : 'reject',
      issues:   [...validation.errors, ...validation.warnings],
      repairs:  [],
      reason:   'Static validation only (AI critic unavailable)',
      dimensions: {},
    };
  }

  console.log(`[Critic] 📊 Score: ${critique.score}/10 | Verdict: ${critique.verdict.toUpperCase()}`);
  console.log(`[Critic] 💬 ${critique.reason}`);
  if (critique.issues.length) {
    console.log(`[Critic] 🚨 Issues: ${critique.issues.slice(0,3).join(' | ')}`);
  }

  // 3. Handle verdict
  if (critique.verdict === 'reject') {
    console.error(`[Critic] ❌ REJECTED — score ${critique.score}/10 is below threshold`);
    return {
      html,
      score:       critique.score,
      verdict:     'reject',
      critique,
      repairCount: 0,
      rejected:    true,
    };
  }

  if (critique.verdict === 'deploy') {
    console.log(`[Critic] ✅ APPROVED — deploying`);
    return {
      html,
      score:       critique.score,
      verdict:     'deploy',
      critique,
      repairCount: 0,
      rejected:    false,
    };
  }

  // Verdict === 'repair'
  console.log(`[Critic] ⚠️  Score ${critique.score}/10 needs repair.`);
  return {
    html:        html,
    score:       critique.score,
    verdict:     'repair',
    critique,
    repairCount: 0,
    rejected:    true,
  };
}

module.exports = { criticAndRepair };
