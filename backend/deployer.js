require('dotenv').config();
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');

// ── Deployer ──────────────────────────────────────────────
// Now deploys strictly by committing to the existing MAIN repository.
// Vercel handles the actual build/deploy automatically upon push.
async function deployToGitHubAndVercel(site) {
  const { repoName, idea } = site;
  
  console.log(`[Deployer] 📁 Updating main project structure for: ${repoName}`);

  // 1. We assume generator.js has already saved the files to /frontend/generated/
  const genDir = path.resolve(__dirname, '../frontend/generated');
  
  try {
    // 2. Commit changes
    console.log(`[Deployer] 📤 Committing changes to existing GitHub repository...`);
    await execPromise(`git add "${genDir}"`);
    
    // Using a generic try-catch for commit in case there's nothing to commit (e.g. testing)
    try {
      await execPromise(`git commit -m "feat: Auto-generated tool - ${repoName}"`);
    } catch (commitErr) {
      if (!commitErr.message.includes('nothing to commit')) {
        throw commitErr;
      }
    }

    // 3. Push to existing repository
    await execPromise('git push');
    console.log(`[Deployer] ✅ Code pushed to GitHub successfully.`);
    
  } catch (err) {
    console.warn(`[Deployer] ⚠️ Git operation failed (Make sure this project is a git repository with a configured remote!):`);
    console.warn(`[Deployer] ${err.message.split('\n')[0]}`);
  }

  // 4. Construct live URLs
  // Since we are deploying to the main site, the URL is just a path under the main domain.
  // Example: mainsite.com/generated/repoName/index.html
  // We'll use relative URLs so the dashboard can link directly to them regardless of the domain.
  
  const liveUrl = `/generated/${repoName}/index.html`;
  
  // GitHub repo URL placeholder (since it's a monorepo now)
  const ghUser = process.env.GITHUB_USER || 'your-username';
  const repoUrl = `https://github.com/${ghUser}/main-platform-repo/tree/main/frontend/generated/${repoName}`;

  console.log(`[Deployer] ✅ Tool will be live at: ${liveUrl} (once Vercel finishes auto-deploy)`);
  
  return { repoUrl, liveUrl };
}

module.exports = { deployToGitHubAndVercel };
