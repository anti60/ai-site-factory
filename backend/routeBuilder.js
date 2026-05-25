const path = require('path');
const fse  = require('fs-extra');

// Path to the Next.js generated routes registry
const ROUTES_FILE = path.resolve(__dirname, '../frontend/generated/routes.json');

/**
 * Add a route entry for a newly generated site.
 * The Next.js frontend reads this file to build dynamic pages.
 */
async function addRoute(metadata) {
  await fse.ensureFile(ROUTES_FILE);

  let routes = [];
  try {
    routes = await fse.readJson(ROUTES_FILE);
  } catch (_) { routes = []; }

  // Avoid duplicates
  const exists = routes.find(r => r.slug === metadata.repoName);
  if (!exists) {
    routes.unshift({
      slug:      metadata.repoName,
      idea:      metadata.idea,
      type:      metadata.type,
      style:     metadata.style,
      repoUrl:   metadata.repoUrl,
      liveUrl:   metadata.liveUrl,
      score:     metadata.score,
      createdAt: metadata.createdAt,
    });
    await fse.writeJson(ROUTES_FILE, routes, { spaces: 2 });
    console.log(`[RouteBuilder] ✅ Route added: /generated/${metadata.repoName}`);
  }
}

/**
 * Remove a route (for rejected/failed sites).
 */
async function removeRoute(slug) {
  if (!(await fse.pathExists(ROUTES_FILE))) return;
  let routes = await fse.readJson(ROUTES_FILE).catch(() => []);
  routes = routes.filter(r => r.slug !== slug);
  await fse.writeJson(ROUTES_FILE, routes, { spaces: 2 });
  console.log(`[RouteBuilder] 🗑  Route removed: /generated/${slug}`);
}

/**
 * Get all current routes.
 */
async function getRoutes() {
  if (!(await fse.pathExists(ROUTES_FILE))) return [];
  return fse.readJson(ROUTES_FILE).catch(() => []);
}

module.exports = { addRoute, removeRoute, getRoutes };
