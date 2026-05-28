import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITE_URL = 'https://active.situee.ch';
const SITUATED_LOGO_URL = 'https://raw.githubusercontent.com/action-situee/assets/380a38d67ffe6f8270cf52c0d9431d1f05f3b12e/images/Fichier_36-5.svg';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');
const siteUrl = normalizeSiteUrl(process.env.VITE_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL);
const today = new Date().toISOString().slice(0, 10);

const routes = [
  {
    path: '/',
    title: 'Atlas Mobilité Active | Marchabilité et cyclabilité',
    description: 'Atlas cartographique de mobilité active pour explorer les indices de marchabilité et de cyclabilité dans le Grand Genève et le Canton de Genève.',
    keywords: 'mobilité active, marchabilité, cyclabilité, Grand Genève, Canton de Genève, carte interactive, diagnostic territorial',
    themeColor: '#2E6A4A',
    priority: '1.0'
  },
  {
    path: '/marchabilite',
    title: 'Indice de marchabilité | Atlas Mobilité Active',
    description: 'Carte interactive de l’indice de marchabilité pour diagnostiquer les continuités piétonnes, ruptures de parcours et conditions de marche dans le Grand Genève et le Canton de Genève.',
    keywords: 'marchabilité, mobilité piétonne, marche, Grand Genève, Canton de Genève, diagnostic territorial, carte interactive',
    themeColor: '#D7A31B',
    priority: '0.9'
  },
  {
    path: '/cyclabilite',
    title: 'Indice de cyclabilité | Atlas Mobilité Active',
    description: 'Carte interactive de l’indice de cyclabilité pour diagnostiquer les continuités cyclables, ruptures d’itinéraires et conditions de sécurité à vélo dans le Grand Genève et le Canton de Genève.',
    keywords: 'cyclabilité, vélo, mobilité cyclable, Grand Genève, Canton de Genève, diagnostic territorial, carte interactive',
    themeColor: '#2E6A4A',
    priority: '0.9'
  }
];

function normalizeSiteUrl(value) {
  return String(value || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
}

function absoluteUrl(routePath) {
  return `${siteUrl}${routePath === '/' ? '/' : routePath}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function jsonLd(route) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: route.title,
    url: absoluteUrl(route.path),
    description: route.description,
    applicationCategory: 'MapApplication',
    operatingSystem: 'Web',
    inLanguage: 'fr-CH',
    provider: {
      '@type': 'Organization',
      name: 'Bureau Action Située',
      url: 'https://situee.ch'
    }
  });
}

function replaceOrInsert(html, pattern, replacement, before = '</head>') {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace(before, `    ${replacement}\n  ${before}`);
}

function renderRouteHtml(baseHtml, route) {
  const url = absoluteUrl(route.path);
  let html = baseHtml;

  const replacements = [
    [/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(route.title)}</title>`],
    [/<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(route.description)}" />`],
    [/<meta\s+name="keywords"\s+content="[^"]*"\s*\/>/, `<meta name="keywords" content="${escapeHtml(route.keywords)}" />`],
    [/<meta\s+name="theme-color"\s+content="[^"]*"\s*\/>/, `<meta name="theme-color" content="${route.themeColor}" />`],
    [/<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}" />`],
    [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(route.title)}" />`],
    [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(route.description)}" />`],
    [/<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}" />`],
    [/<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/, `<meta property="og:image" content="${SITUATED_LOGO_URL}" />`],
    [/<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/>/, '<meta property="og:image:alt" content="Logo Située" />'],
    [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`],
    [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`],
    [/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:image" content="${SITUATED_LOGO_URL}" />`],
    [/<script\s+type="application\/ld\+json"\s+id="structured-data">[\s\S]*?<\/script>/, `<script type="application/ld+json" id="structured-data">${jsonLd(route)}</script>`]
  ];

  for (const [pattern, replacement] of replacements) {
    html = replaceOrInsert(html, pattern, replacement);
  }

  return html;
}

function sitemapXml() {
  const urls = routes.map((route) => `  <url>
    <loc>${absoluteUrl(route.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

async function main() {
  const indexPath = path.join(buildDir, 'index.html');
  const baseHtml = await readFile(indexPath, 'utf8');

  await writeFile(indexPath, renderRouteHtml(baseHtml, routes[0]));

  for (const route of routes.slice(1)) {
    const routeDir = path.join(buildDir, route.path);
    await mkdir(routeDir, { recursive: true });
    await writeFile(path.join(routeDir, 'index.html'), renderRouteHtml(baseHtml, route));
  }

  await writeFile(path.join(buildDir, 'sitemap.xml'), sitemapXml());
  await writeFile(path.join(buildDir, 'robots.txt'), `User-agent: *
Allow: /

Sitemap: ${absoluteUrl('/sitemap.xml')}
`);

  console.log(`SEO files generated for ${siteUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
