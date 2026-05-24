// Per-route HTML prerendering + sitemap.xml + robots.txt.
// Runs after `vite build`. Reads dist/public/index.html and emits one HTML
// file per route under dist/public/<route>/index.html with route-specific
// <title>, <meta description>, og:*/twitter:* and <link rel="canonical">.
//
// Why: Vite builds a single index.html for the whole SPA. Link scrapers
// (FB/WhatsApp/Twitter/iMessage/Slack/etc.) only read the HEAD — without
// per-route HTML they'd see the homepage meta on every URL. This script
// fixes that with no headless browser and no runtime cost.
//
// pageMeta lives in src/lib/pageMeta.ts so the runtime <PageTitle> component
// and this build-time script share one source of truth.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "dist", "public");
const PAGE_META_TS = path.resolve(__dirname, "src", "lib", "pageMeta.ts");

// Parse pageMeta.ts as text — we don't want to spin up a TS compiler in this
// tiny build script. The file is shaped predictably; we just need the data.
function loadPageMeta() {
  const src = fs.readFileSync(PAGE_META_TS, "utf8");

  // Hard-fail if SITE_URL is missing or in an unexpected format — silently
  // falling back to a default would let the wrong canonical/sitemap domain
  // ship to production and we'd only notice weeks later in Search Console.
  const siteUrlMatch = src.match(/SITE_URL\s*=\s*"([^"]+)"/);
  if (!siteUrlMatch) {
    throw new Error(
      `[prerender] Could not parse SITE_URL from ${PAGE_META_TS}. ` +
        `Expected literal of form: export const SITE_URL = "https://...";`,
    );
  }
  const SITE_URL = siteUrlMatch[1];

  // Extract the pageMeta object literal as a string. Tightly coupled to the
  // file's current shape — if you refactor pageMeta.ts (e.g. switch to
  // `satisfies`, inferred type, or move to JSON), update this regex too.
  const objMatch = src.match(
    /pageMeta:\s*Record<string,\s*PageMeta>\s*=\s*(\{[\s\S]*?\n\});/,
  );
  if (!objMatch) {
    throw new Error(
      `[prerender] Could not find pageMeta literal in ${PAGE_META_TS}. ` +
        `If you refactored pageMeta.ts, update the regex in prerender.mjs.`,
    );
  }

  // eslint-disable-next-line no-new-func
  const pageMeta = new Function(`return (${objMatch[1]});`)();
  if (!pageMeta || typeof pageMeta !== "object" || Array.isArray(pageMeta)) {
    throw new Error(`[prerender] Parsed pageMeta is not an object literal.`);
  }
  return { SITE_URL, pageMeta };
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function rewriteHead(html, route, pageMeta, SITE_URL) {
  const meta = pageMeta[route];
  if (!meta) return html;
  const canonical = `${SITE_URL}${route}`;

  // Every rewrite is REQUIRED — a missing match means index.html's HEAD was
  // refactored and the prerender is silently doing nothing for that tag.
  // Throw hard so SEO regressions surface at build time, not weeks later.
  const tags = [
    { name: "title", re: /<title>[^<]*<\/title>/, replacement: `<title>${escapeHtml(meta.title)}</title>` },
    { name: "meta description", re: /(<meta\s+name="description"\s+content=")[^"]*(")/, replacement: `$1${escapeAttr(meta.description)}$2` },
    { name: "og:title", re: /(<meta\s+property="og:title"\s+content=")[^"]*(")/, replacement: `$1${escapeAttr(meta.title)}$2` },
    { name: "og:description", re: /(<meta\s+property="og:description"\s+content=")[^"]*(")/, replacement: `$1${escapeAttr(meta.description)}$2` },
    { name: "og:url", re: /(<meta\s+property="og:url"\s+content=")[^"]*(")/, replacement: `$1${escapeAttr(canonical)}$2` },
    { name: "twitter:title", re: /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, replacement: `$1${escapeAttr(meta.title)}$2` },
    { name: "twitter:description", re: /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, replacement: `$1${escapeAttr(meta.description)}$2` },
    { name: "canonical link", re: /(<link\s+rel="canonical"\s+href=")[^"]*(")/, replacement: `$1${escapeAttr(canonical)}$2` },
  ];

  for (const { name, re, replacement } of tags) {
    if (!re.test(html)) {
      throw new Error(
        `[prerender] Route "${route}": expected HEAD tag <${name}> not found in index.html. ` +
          `If you refactored the HEAD, update prerender.mjs to match the new tag format.`,
      );
    }
    html = html.replace(re, replacement);
  }

  return html;
}

function main() {
  const { SITE_URL, pageMeta } = loadPageMeta();

  const indexPath = path.join(DIST, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error(`[prerender] dist/public/index.html missing — did you run vite build?`);
    process.exit(1);
  }
  const baseHtml = fs.readFileSync(indexPath, "utf8");

  // Routes that should NOT get a prerendered file (private / per-user).
  const SKIP = new Set(["/admin", "/cart"]);
  const routes = Object.keys(pageMeta).filter((r) => !SKIP.has(r));

  let written = 0;
  for (const route of routes) {
    if (route === "/") {
      // Overwrite root with the home-meta version (mostly identical, but ensures consistency).
      fs.writeFileSync(indexPath, rewriteHead(baseHtml, "/", pageMeta, SITE_URL));
    } else {
      const dir = path.join(DIST, route.replace(/^\//, ""));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, "index.html"),
        rewriteHead(baseHtml, route, pageMeta, SITE_URL),
      );
    }
    written++;
  }

  // sitemap.xml
  const lastmod = new Date().toISOString().slice(0, 10);

  // Deduplicate — pageMeta already includes /blog/:slug routes, so we don't
  // add them separately. Build a priority map then emit each URL exactly once.
  const seen = new Set();
  const allUrls = routes
    .filter((r) => { if (seen.has(r)) return false; seen.add(r); return true; })
    .map((r) => {
      const url = `${SITE_URL}${r}`;
      const isBlogPost = r.startsWith("/blog/");
      const priority = r === "/" ? "1.0" : r === "/lucky" ? "0.9" : isBlogPost ? "0.7" : "0.8";
      const changefreq = isBlogPost ? "monthly" : "weekly";
      return `  <url><loc>${url}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
    });

  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    allUrls.join("\n") +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap);

  // robots.txt
  const robots =
    `User-agent: *\n` +
    `Allow: /\n` +
    `Disallow: /admin\n` +
    `Disallow: /cart\n` +
    `Disallow: /blog/*?utm_\n` +
    `Disallow: /*?\n\n` +
    `Sitemap: ${SITE_URL}/sitemap.xml\n`;
  fs.writeFileSync(path.join(DIST, "robots.txt"), robots);

  console.log(
    `[prerender] wrote ${written} per-route HTML files + sitemap.xml + robots.txt`,
  );
}

main();
