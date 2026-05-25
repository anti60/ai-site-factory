const { callAI, extractJSON } = require('../backend/openrouter');

const REPAIR_SYSTEM = `You are an expert web developer and code repair agent inside an autonomous web tool generation platform.

You will receive:
1. An HTML file that failed quality review
2. Specific issues found by the critic AI
3. Required repairs

Your job: fix ALL issues while preserving the design intent.

REPAIR PRIORITIES (in order):
1. Fix broken JavaScript / syntax errors
2. Add missing mobile responsiveness (media queries)
3. Fix placeholder/lorem ipsum content
4. Add missing interactivity (event listeners, animations)
5. Fix UI layout issues
6. Add missing error handling for APIs
7. Add loading states where missing
8. Improve visual polish

RULES:
• Keep the same brand/idea
• Do NOT change the overall design direction
• Do NOT remove working features
• Keep all CSS inline in <style> tags
• Keep all JS inline in <script> tags
• Output must be a complete, deployable index.html

Reply ONLY with valid JSON, no markdown:
{"html":"complete repaired html here"}`;

/**
 * Ask the AI to repair issues in generated HTML.
 * @param {string}   html    Current HTML to repair
 * @param {string}   idea    The original site idea
 * @param {string[]} issues  Critic-reported issues + repair suggestions
 * @returns {Promise<string>} Repaired HTML
 */
async function repair(html, idea, issues) {
  const issueList = issues.slice(0, 12).map((s, i) => `${i + 1}. ${s}`).join('\n');

  const user = `Site idea: "${idea}"

ISSUES FOUND BY CRITIC:
${issueList}

HTML TO REPAIR (up to 12000 chars):
${html.slice(0, 12000)}`;

  console.log(`[RepairAgent] 🔧 Sending ${issues.length} issues to AI…`);
  const raw    = await callAI(REPAIR_SYSTEM, user, 4096);
  const parsed = extractJSON(raw);

  if (!parsed.html || parsed.html.length < 300)
    throw new Error('Repair agent returned invalid or empty HTML.');

  console.log(`[RepairAgent] ✅ Repaired (${parsed.html.length} chars)`);
  return parsed.html;
}

module.exports = { repair };
