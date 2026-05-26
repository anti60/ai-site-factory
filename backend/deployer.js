require('dotenv').config();
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');

// ── Deployer ──────────────────────────────────────────────
// Commits the newly generated site into the monorepo and pushes to GitHub.
// Vercel auto-redeploys the platform when it detects new commits on main.
async function deployToGitHubAndVercel(site) {
  const { repoName } = site;

  // Root of the git repository (one level above /backend)
  const REPO_ROOT = path.resolve(__dirname, '..');
  const GITHUB_USER  = process.env.GITHUB_USER  || 'anti60';
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
  const REPO_NAME    = 'ai-site-factory';

  // Authenticated remote so we never need stored credentials
  const remoteUrl = `https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git`;

  const exec = (cmd) => execPromise(cmd, { cwd: REPO_ROOT });

  console.log(`[Deployer] 📁 Committing new site: ${repoName}`);

  try {
    // Ensure the authenticated remote exists / is up to date
    try {
      await exec(`git remote set-url origin "${remoteUrl}"`);
    } catch (_) {
      await exec(`git remote add origin "${remoteUrl}"`);
    }

    // Stage the generated directory (relative path from repo root)
    await exec(`git add frontend/generated`);

    // Set git identity (required when no global config exists)
    await exec(`git config user.name "${GITHUB_USER}"`);
    await exec(`git config user.email "${GITHUB_USER}@users.noreply.github.com"`);

    // Commit — ignore "nothing to commit" gracefully
    try {
      await exec(`git commit -m "feat: auto-deploy ${repoName}"`);
      console.log(`[Deployer] ✅ Committed to git.`);
    } catch (commitErr) {
      if (!commitErr.message.includes('nothing to commit')) throw commitErr;
      console.log(`[Deployer] ℹ️  Nothing new to commit — already up to date.`);
    }

    // Push to GitHub → triggers Vercel auto-deploy
    await exec(`git push origin main`);
    console.log(`[Deployer] 🚀 Pushed to GitHub — Vercel deploy triggered!`);

  } catch (err) {
    console.error(`[Deployer] ❌ Git push failed: ${err.message.split('\n')[0]}`);
  }

  const ghUser  = process.env.GITHUB_USER || 'anti60';
  const liveUrl = `/generated/${repoName}/index.html`;
  const repoUrl = `https://github.com/${ghUser}/${REPO_NAME}/tree/main/frontend/generated/${repoName}`;

  console.log(`[Deployer] ✅ Will be live at: ${liveUrl}`);
  return { repoUrl, liveUrl };
}

module.exports = { deployToGitHubAndVercel };
