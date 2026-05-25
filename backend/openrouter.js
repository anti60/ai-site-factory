require('dotenv').config();
const axios = require('axios');

const MODELS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'mistralai/mixtral-8x7b-instruct',
];

/**
 * Call OpenRouter with automatic model fallback.
 * @param {string} system  System prompt
 * @param {string} user    User message
 * @param {number} maxTokens
 * @returns {Promise<string>} Raw content string from AI
 */
async function callAI(system, user, maxTokens = 4096) {
  const key = process.env.OPENROUTER_KEY;
  if (!key) throw new Error('OPENROUTER_KEY not set in .env');

  for (const model of MODELS) {
    try {
      const res = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model,
          temperature: 0.9,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user',   content: user   },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai-site-factory.local',
            'X-Title': 'AI Site Factory',
          },
          timeout: 90000,
        }
      );
      const content = res.data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from model');
      console.log(`[OpenRouter] ✅ Used model: ${model}`);
      return content;
    } catch (err) {
      const status = err.response?.status;
      if (status === 402 || status === 429) {
        console.warn(`[OpenRouter] ⚠️  ${model} — credits/rate limit, trying next…`);
        continue;
      }
      throw err;
    }
  }
  throw new Error('All OpenRouter models failed. Please top up credits.');
}

/**
 * Extract JSON from raw AI response (handles markdown fences).
 */
function extractJSON(raw) {
  // Direct parse
  try { return JSON.parse(raw); } catch (_) {}
  // Strip ```json ... ```
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) try { return JSON.parse(m[1].trim()); } catch (_) {}
  // Find first { ... }
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s !== -1 && e !== -1) try { return JSON.parse(raw.slice(s, e + 1)); } catch (_) {}
  throw new Error('Could not parse JSON from AI response.');
}

module.exports = { callAI, extractJSON };
