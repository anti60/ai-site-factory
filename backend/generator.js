require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fse     = require('fs-extra');
const { callAI, extractJSON }     = require('./openrouter');
const { criticAndRepair }         = require('../critic/criticAgent');
const { repair }                  = require('../critic/repairAgent');
const { deployToGitHubAndVercel } = require('./deployer');
const { addRoute }                = require('./routeBuilder');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: [
    'https://ai-site-factory-green.vercel.app',
    'https://ai-site-factory.vercel.app',
    /\.vercel\.app$/,
    'http://localhost:4000'
  ],
  methods: ['GET','POST']
}));
app.use(express.json());

const FRONTEND = path.resolve(__dirname, '../frontend');
app.use(express.static(FRONTEND));
console.log(`[Server] 📂 Serving frontend from: ${FRONTEND}`);

// ── Job tracking ──────────────────────────────────────────
const jobs = new Map();

function createJob() {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const job = {
    id,
    status: 'running',   // running | done | error
    stage: 0,            // 1=generating, 2=critiquing, 3=repairing, 4=deploying
    stageLabel: 'Starting…',
    stageDetail: '',
    stageTimes: {},      // stage# → elapsed ms when that stage completed
    startedAt: Date.now(),
    elapsedMs: 0,
    site: null,
    error: null
  };
  jobs.set(id, job);
  setTimeout(() => jobs.delete(id), 15 * 60 * 1000); // auto-clean after 15 min
  return job;
}

function setStage(job, stage, label, detail = '') {
  if (!job) return;
  job.stage      = stage;
  job.stageLabel = label;
  job.stageDetail = detail;
  job.elapsedMs  = Date.now() - job.startedAt;
  console.log(`[Job ${job.id}] ▶ Stage ${stage}: ${label}${detail ? ' — ' + detail : ''}`);
}

function doneStage(job, stage) {
  if (!job) return;
  job.stageTimes[stage] = Date.now() - job.startedAt;
}

// ── Shared pools ──────────────────────────────────────────
const STYLES = ['cyberpunk neon','brutalism','glassmorphism','minimalist editorial','luxury dark','sci-fi holographic','retro terminal','AI aesthetic','vaporwave','neobrutalism'];
const FONTS  = ['Space Grotesk','Plus Jakarta Sans','DM Sans','Syne','Outfit','Inter','Manrope'];
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

const BACK_BTN = `<a href="https://ai-site-factory-green.vercel.app" id="__back_btn" style="position:fixed;bottom:20px;right:20px;z-index:99999;background:rgba(10,10,15,0.9);backdrop-filter:blur(10px);color:#58a6ff;border:1px solid rgba(88,166,255,0.4);padding:10px 18px;border-radius:50px;font-family:sans-serif;font-size:14px;font-weight:600;text-decoration:none;box-shadow:0 4px 20px rgba(0,0,0,0.5);">← AI Site Factory</a>`;

// ── Category system prompts ───────────────────────────────
const SYSTEM_PROMPTS = {
  user: (type, style, font) => `You are an elite autonomous web designer and developer.
Create a complete, production-ready, single-file index.html (ALL CSS and JS inline) for a ${type} website.
Visual style: ${style}. Primary font: ${font} (load from Google Fonts).

MANDATORY: Include this exact HTML just before </body>:
${BACK_BTN}

REQUIREMENTS:
- Animated hero section with CSS keyframe animations
- Interactive navigation with hover effects
- Fully responsive (mobile-first)
- Real brand name and realistic content — NO lorem ipsum
- Semantic HTML5, CSS custom properties, at least 4 sections
- At least 2 interactive JS features with real functionality
- Premium feel comparable to Awwwards
- FREE API optional: wttr.in, api.coingecko.com, dog.ceo, etc. (DO NOT use api.quotable.io, it is offline)

STRICT CODING RULES:
1. Vanilla JavaScript ONLY. Do NOT use jQuery or $ syntax.
2. If using fetch(), wrap in try/catch and silently fallback gracefully on failure. Do not leave uncaught errors.
3. NEVER use $1, $2 variables unless properly defined in regex.

Reply ONLY with valid JSON: {"idea":"one-line brand description","repoName":"kebab-case-name","html":"complete html string"}`,

  game: (style, font) => `You are an elite AI game website generator.
Create a complete browser-based mini game as a single index.html with ALL CSS and JS inline.
Visual style: ${style}. Font: ${font} from Google Fonts.

MANDATORY: Include this exact HTML just before </body>:
${BACK_BTN}

GAME REQUIREMENTS:
- Fully playable in browser, no backend, works instantly
- Game types: arcade, clicker, reflex, puzzle, memory, typing, reaction, endless runner, survival, retro, cyberpunk
- Clear objectives, scoring system, restart button, difficulty progression
- Mobile responsive controls (touch + keyboard)
- Polished game HUD, smooth animations, satisfying interactions
- Strong visual effects, particle systems if applicable

STRICT CODING RULES:
1. Vanilla JavaScript ONLY. Do NOT use jQuery or $ syntax.
2. NEVER use $1, $2 variables unless properly defined in regex.
3. Handle canvas drawing cleanly.

FORBIDDEN: broken controls, unfinished gameplay, fake UI, copied famous games

Reply ONLY with valid JSON: {"idea":"one-line game description","repoName":"kebab-case-name","html":"complete html string"}`,

  tool: (style, font) => `You are an elite AI utility tool generator.
Create a complete browser-based utility tool as a single index.html with ALL CSS and JS inline.
Visual style: ${style}. Font: ${font} from Google Fonts.

MANDATORY: Include this exact HTML just before </body>:
${BACK_BTN}

TOOL REQUIREMENTS:
- Solves one clear real daily problem
- Works instantly, no backend needed
- Tool ideas: QR generator, password generator, weather app, pomodoro timer, calculator, note app, markdown previewer, expense tracker, unit converter, gradient generator, focus timer, color palette picker, JSON formatter, regex tester, word counter
- Modern polished UI, smooth transitions, interactive feedback
- Mobile responsive
- May use free public APIs: wttr.in, api.coingecko.com, etc. (DO NOT use api.quotable.io, it is offline)

STRICT CODING RULES:
1. Vanilla JavaScript ONLY. Do NOT use jQuery or $ syntax.
2. If using fetch(), wrap in try/catch and silently fallback gracefully on failure. Do not leave uncaught errors.
3. NEVER use $1, $2 variables unless properly defined in regex.

FORBIDDEN: broken APIs, unfinished UI, fake buttons, authentication systems

Reply ONLY with valid JSON: {"idea":"one-line tool description","repoName":"kebab-case-name","html":"complete html string"}`,

  random: (style, font) => `You are an experimental AI creative website generator.
Create a highly creative, experimental, visually stunning browser-based experience as a single index.html with ALL CSS and JS inline.
Visual style: ${style}. Font: ${font} from Google Fonts.

MANDATORY: Include this exact HTML just before </body>:
${BACK_BTN}

CREATIVE REQUIREMENTS:
- Experimental, visually unique, interactive
- Ideas: futuristic interfaces, interactive art, cyberpunk experiments, animated storytelling, abstract experiences, AI art interfaces, sci-fi concepts, digital playgrounds, immersive animations, creative visual toys
- Canvas effects, SVG animations, particle systems, mouse interactions encouraged
- Every generation must feel completely unique
- Should feel like award-winning creative coding experiments

STRICT CODING RULES:
1. Vanilla JavaScript ONLY. Do NOT use jQuery or $ syntax.
2. If using fetch(), wrap in try/catch and silently fallback gracefully on failure. Do not leave uncaught errors.
3. NEVER use $1, $2 variables unless properly defined in regex.

FORBIDDEN: boring layouts, copied templates, unfinished sections, broken interactions

Reply ONLY with valid JSON: {"idea":"one-line description","repoName":"kebab-case-name","html":"complete html string"}`
};

// ── Generate one site ─────────────────────────────────────
async function generateSite(userPrompt = '', category = 'user', opts = {}) {
  const style = opts.style || pick(STYLES);
  const font  = opts.font  || pick(FONTS);
  const SITE_TYPES = ['SaaS landing page','AI startup','creative portfolio','gaming landing page','music platform','architecture studio','fashion brand','futuristic agency','cybersecurity company','productivity tool'];
  const type = pick(SITE_TYPES);

  const extras = [];
  if (opts.palette) {
    extras.push(`COLOR PALETTE: Use primary=${opts.palette.primary}, secondary=${opts.palette.secondary}, accent=${opts.palette.accent} as your CSS custom properties.`);
  }
  if (opts.complexity === 'quick')   extras.push('COMPLEXITY: Keep it concise — single-page, minimal JS, fast to load.');
  if (opts.complexity === 'rich')    extras.push('COMPLEXITY: Make it feature-rich — multiple sections, advanced animations, high interactivity.');
  if (opts.toggles) {
    if (opts.toggles.animations)  extras.push('REQUIRED: Use rich CSS keyframe animations and smooth transitions throughout.');
    if (opts.toggles.mobilefirst) extras.push('REQUIRED: Mobile-first responsive design. Test at 375px, 768px, 1280px widths.');
    if (opts.toggles.apidata)     extras.push('REQUIRED: Fetch real live data from a free public API (wttr.in, api.coingecko.com, etc).');
    if (opts.toggles.darkonly)    extras.push('REQUIRED: Dark mode only — deep dark background, light text, no light theme.');
    if (opts.toggles.particles)   extras.push('REQUIRED: Include a canvas-based particle system for visual depth.');
    if (opts.toggles.canvas)      extras.push('REQUIRED: Use HTML5 Canvas for at least one major visual element or interactive graphic.');
  }
  // Tweak instructions if re-running on an existing site
  if (opts.tweakPrompt) {
    extras.push(`TWEAK INSTRUCTIONS: The user wants these specific changes: ${opts.tweakPrompt}`);
  }
  const extraInstructions = extras.length ? '\n\nUSER OVERRIDE REQUIREMENTS:\n' + extras.join('\n') : '';

  let system;
  if (category === 'game')        system = SYSTEM_PROMPTS.game(style, font) + extraInstructions;
  else if (category === 'tool')   system = SYSTEM_PROMPTS.tool(style, font) + extraInstructions;
  else if (category === 'random') system = SYSTEM_PROMPTS.random(style, font) + extraInstructions;
  else                            system = SYSTEM_PROMPTS.user(type, style, font) + extraInstructions;

  const user = userPrompt || (category === 'user'
    ? `Build a stunning ${type} with ${style} visual style.`
    : `Generate a unique ${category} website with ${style} aesthetics.`);

  const maxTokens = opts.complexity === 'rich' ? 6000 : opts.complexity === 'quick' ? 2500 : 4096;
  console.log(`[Generator] 🤖 category=${category} | ${style} | ${font} | complexity=${opts.complexity||'standard'}`);
  const raw    = await callAI(system, user, maxTokens);
  const parsed = extractJSON(raw);

  if (!parsed.html || parsed.html.length < 500) throw new Error('Generated HTML too short.');

  // If tweaking existing site, preserve its name
  if (opts.existingSiteName) {
    parsed.repoName = opts.existingSiteName;
  } else {
    parsed.repoName = (parsed.repoName || `ai-${category}-${Date.now()}`)
      .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 64);
  }

  console.log(`[Generator] ✅ ${parsed.idea} → ${parsed.repoName}`);
  return { ...parsed, type, style, font, category };
}

// ── Full pipeline ─────────────────────────────────────────
async function runPipeline(userPrompt = '', category = 'user', opts = {}, job = null) {
  setStage(job, 1, 'AI Generation', 'Building your website with AI…');

  let site = await generateSite(userPrompt, category, opts);
  doneStage(job, 1);

  setStage(job, 2, 'Critic Agent', `Scoring "${site.idea}" across 6 quality dimensions…`);
  const criticResult = await criticAndRepair(site.html, site.idea);
  site.html = criticResult.html;
  doneStage(job, 2);

  if (criticResult.rejected) {
    setStage(job, 3, 'Auto Repair', `Score ${criticResult.score}/10 — Applying fixes…`);
    try {
      const allIssues = [...(criticResult.critique?.issues||[]), ...(criticResult.critique?.repairs||[])];
      const repairedHtml = await repair(site.html, site.idea, allIssues);
      const retry = await criticAndRepair(repairedHtml, site.idea);
      
      // Keep repaired version if score didn't get worse
      if (retry.score >= criticResult.score) {
        site.html = repairedHtml;
        Object.assign(criticResult, retry);
      }
      criticResult.rejected = false; // Accept it to move forward quickly
    } catch (retryErr) {
      console.error(`[Pipeline] Repair failed: ${retryErr.message}`);
      criticResult.rejected = false;
    }
    doneStage(job, 3);
  } else {
    if (job) job.stageTimes[3] = null; // null = skipped
  }

  setStage(job, 4, 'Deploying', `Uploading "${site.repoName}" to GitHub…`);

  const ghUser    = process.env.GITHUB_USER || 'anti60';
  const REPO_NAME = 'ai-site-factory';
  const liveUrl   = `/generated/${site.repoName}/index.html`;
  const repoUrl   = `https://github.com/${ghUser}/${REPO_NAME}/tree/main/frontend/generated/${site.repoName}`;

  const metadata = {
    id:        site.repoName + '-' + Date.now(),
    idea:      site.idea,
    repoName:  site.repoName,
    category:  site.category || 'user',
    type:      site.type,
    style:     site.style,
    font:      site.font,
    repoUrl,   liveUrl,
    score:     criticResult.score,
    verdict:   criticResult.verdict,
    repairs:   criticResult.repairCount,
    critique:  criticResult.critique?.reason || '',
    dimensions: criticResult.critique?.dimensions || {},
    createdAt: new Date().toISOString(),
  };

  const genDir = path.resolve(__dirname, '../frontend/generated');
  await fse.ensureDir(path.join(genDir, site.repoName));
  await fse.writeFile(path.join(genDir, site.repoName, 'index.html'), site.html, 'utf-8');

  const metaPath = path.join(genDir, 'sites.json');
  let sites = [];
  if (await fse.pathExists(metaPath)) sites = await fse.readJson(metaPath).catch(() => []);

  // If tweaking, update existing entry; otherwise prepend
  if (opts.existingSiteName) {
    const idx = sites.findIndex(s => s.repoName === opts.existingSiteName);
    if (idx >= 0) sites[idx] = metadata; else sites.unshift(metadata);
  } else {
    sites.unshift(metadata);
  }
  await fse.writeJson(metaPath, sites, { spaces: 2 });

  await addRoute(metadata);
  await deployToGitHubAndVercel(site);

  doneStage(job, 4);
  if (job) {
    job.status   = 'done';
    job.site     = metadata;
    job.elapsedMs = Date.now() - job.startedAt;
    job.stageLabel = 'Complete!';
    job.stageDetail = `Live at /generated/${site.repoName}/index.html`;
  }

  console.log(`[Pipeline] ✅ Live: ${liveUrl}`);
  return { ...metadata, log: [] };
}

// ── Auto-scheduler ────────────────────────────────────────
const SCHEDULE_MS = {
  game:   30 * 60 * 1000,
  tool:   45 * 60 * 1000,
  random: 60 * 60 * 1000,
};
const NEXT_DEPLOY = {};
function scheduleCategory(category) {
  const ms = SCHEDULE_MS[category];
  NEXT_DEPLOY[category] = Date.now() + ms;
  setTimeout(async () => {
    console.log(`[Scheduler] ⏰ Auto-generating ${category}…`);
    try { await runPipeline('', category); } catch(e) { console.error(`[Scheduler] ❌ ${category}: ${e.message}`); }
    scheduleCategory(category);
  }, ms);
  console.log(`[Scheduler] ✅ ${category} scheduled every ${ms/60000}min`);
}
['game','tool','random'].forEach(scheduleCategory);

// ── API routes ────────────────────────────────────────────

// Generate — returns jobId immediately, runs async
app.post('/api/generate', async (req, res) => {
  const { prompt = '', category = 'user', style, font, palette, complexity, toggles } = req.body;
  const job  = createJob();
  const opts = { style, font, palette, complexity, toggles };
  res.json({ jobId: job.id });
  runPipeline(prompt, category, opts, job).catch(err => {
    job.status = 'error';
    job.error  = err.message;
    console.error('[API] ❌', err.message);
  });
});

// Poll job status
app.get('/api/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// Tweak an existing site
app.post('/api/tweak', async (req, res) => {
  const { siteName, prompt = '', category = 'user' } = req.body;
  if (!siteName) return res.status(400).json({ error: 'siteName is required' });
  const job  = createJob();
  const opts = { existingSiteName: siteName, tweakPrompt: prompt };
  res.json({ jobId: job.id });
  runPipeline(prompt, category, opts, job).catch(err => {
    job.status = 'error';
    job.error  = err.message;
  });
});

// Sites list
app.get('/api/sites', async (req, res) => {
  try {
    const metaPath = path.join(FRONTEND, 'generated', 'sites.json');
    const sites = (await fse.pathExists(metaPath)) ? await fse.readJson(metaPath).catch(() => []) : [];
    res.json(sites);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Schedule countdowns
app.get('/api/schedule', (req, res) => res.json(NEXT_DEPLOY));

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Fallback
app.get('*', (req, res) => res.sendFile(path.join(FRONTEND, 'index.html')));

app.listen(PORT, () => {
  console.log(`\n[Server] 🚀 Running at http://localhost:${PORT}`);
  console.log(`[Server] 🌐 Frontend: http://localhost:${PORT}/index.html`);
  console.log(`[Server] 📊 Dashboard: http://localhost:${PORT}/dashboard.html\n`);
});

module.exports = { runPipeline };
