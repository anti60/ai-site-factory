require('dotenv').config();
const path = require('path');
const fse  = require('fs-extra');

// ── GitHub API Deployer ───────────────────────────────────
// Uses GitHub REST API to upload files directly — no git needed.
// Vercel auto-redeploys when new commits land on main.
async function deployToGitHubAndVercel(site) {
  const { repoName } = site;
  const GITHUB_USER  = process.env.GITHUB_USER  || 'anti60';
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
  const REPO_NAME    = 'ai-site-factory';
  const API_BASE     = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents`;

  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Content-Type':  'application/json',
    'Accept':        'application/vnd.github+json',
    'User-Agent':    'ai-site-factory-bot'
  };

  // Get the SHA of an existing file (required for updates via API)
  async function getFileSHA(filePath) {
    try {
      const r = await fetch(`${API_BASE}/${filePath}`, { headers });
      if (r.ok) { const d = await r.json(); return d.sha || null; }
    } catch (_) {}
    return null;
  }

  // Create or update a single file via GitHub Contents API
  async function uploadFile(filePath, content, message) {
    const sha  = await getFileSHA(filePath);
    const body = { message, content: Buffer.from(content).toString('base64') };
    if (sha) body.sha = sha;

    const r = await fetch(`${API_BASE}/${filePath}`, {
      method: 'PUT', headers, body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || `GitHub API error on ${filePath}`);
    return data;
  }

  console.log(`[Deployer] 📡 Uploading via GitHub API: ${repoName}`);

  const genDir   = path.resolve(__dirname, '../frontend/generated');
  const htmlPath = path.join(genDir, repoName, 'index.html');

  // 1. Upload the generated site HTML
  const html = await fse.readFile(htmlPath, 'utf-8');
  await uploadFile(
    `frontend/generated/${repoName}/index.html`,
    html,
    `feat: auto-deploy ${repoName}`
  );
  console.log(`[Deployer] ✅ Uploaded: frontend/generated/${repoName}/index.html`);

  // 2. Upload updated sites.json
  const metaPath = path.join(genDir, 'sites.json');
  if (await fse.pathExists(metaPath)) {
    const sitesJson = await fse.readFile(metaPath, 'utf-8');
    await uploadFile('frontend/generated/sites.json', sitesJson, 'chore: update sites.json');
    console.log(`[Deployer] ✅ Updated: frontend/generated/sites.json`);
  }

  const liveUrl = `/generated/${repoName}/index.html`;
  const repoUrl = `https://github.com/${GITHUB_USER}/${REPO_NAME}/tree/main/frontend/generated/${repoName}`;

  console.log(`[Deployer] 🚀 GitHub API push complete — Vercel will redeploy!`);
  console.log(`[Deployer] ✅ Will be live at: ${liveUrl}`);
  return { repoUrl, liveUrl };
}

module.exports = { deployToGitHubAndVercel };
