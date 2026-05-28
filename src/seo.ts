import type { AtlasMode } from './config/modes';

const DEFAULT_SITE_URL = 'https://active.situee.ch';
const SITUATED_LOGO_URL = 'https://raw.githubusercontent.com/action-situee/assets/380a38d67ffe6f8270cf52c0d9431d1f05f3b12e/images/Fichier_36-5.svg';

type SeoConfig = {
  path: string;
  title: string;
  description: string;
  keywords: string;
  themeColor: string;
};

const siteOrigin = ((import.meta.env.VITE_SITE_URL as string | undefined) || DEFAULT_SITE_URL).replace(/\/$/, '');

export const DEFAULT_SEO: SeoConfig = {
  path: '/',
  title: 'Atlas Mobilité Active | Marchabilité et cyclabilité',
  description: 'Atlas cartographique de mobilité active pour explorer les indices de marchabilité et de cyclabilité dans le Grand Genève et le Canton de Genève.',
  keywords: 'mobilité active, marchabilité, cyclabilité, Grand Genève, Canton de Genève, carte interactive, diagnostic territorial',
  themeColor: '#2E6A4A'
};

export const SEO_BY_MODE: Record<AtlasMode, SeoConfig> = {
  walkability: {
    path: '/marchabilite',
    title: 'Indice de marchabilité | Atlas Mobilité Active',
    description: 'Carte interactive de l’indice de marchabilité pour diagnostiquer les continuités piétonnes, ruptures de parcours et conditions de marche dans le Grand Genève et le Canton de Genève.',
    keywords: 'marchabilité, mobilité piétonne, marche, Grand Genève, Canton de Genève, diagnostic territorial, carte interactive',
    themeColor: '#D7A31B'
  },
  bikeability: {
    path: '/cyclabilite',
    title: 'Indice de cyclabilité | Atlas Mobilité Active',
    description: 'Carte interactive de l’indice de cyclabilité pour diagnostiquer les continuités cyclables, ruptures d’itinéraires et conditions de sécurité à vélo dans le Grand Genève et le Canton de Genève.',
    keywords: 'cyclabilité, vélo, mobilité cyclable, Grand Genève, Canton de Genève, diagnostic territorial, carte interactive',
    themeColor: '#2E6A4A'
  }
};

const getAbsoluteUrl = (path: string) => `${siteOrigin}${path === '/' ? '/' : path}`;

const ensureMeta = (selector: string, create: () => HTMLMetaElement) => {
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (existing) return existing;
  const element = create();
  document.head.appendChild(element);
  return element;
};

const setNamedMeta = (name: string, content: string) => {
  const element = ensureMeta(`meta[name="${name}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    return meta;
  });
  element.setAttribute('content', content);
};

const setPropertyMeta = (property: string, content: string) => {
  const element = ensureMeta(`meta[property="${property}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', property);
    return meta;
  });
  element.setAttribute('content', content);
};

const setCanonical = (href: string) => {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', href);
};

const setStructuredData = (seo: SeoConfig, url: string) => {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: seo.title,
    url,
    description: seo.description,
    applicationCategory: 'MapApplication',
    operatingSystem: 'Web',
    inLanguage: 'fr-CH',
    provider: {
      '@type': 'Organization',
      name: 'Bureau Action Située',
      url: 'https://situee.ch'
    }
  };

  let script = document.head.querySelector<HTMLScriptElement>('script#structured-data');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'structured-data';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
};

export const applySeoForMode = (mode: AtlasMode) => {
  const seo = SEO_BY_MODE[mode] || DEFAULT_SEO;
  const canonicalUrl = getAbsoluteUrl(seo.path);
  document.documentElement.lang = 'fr-CH';
  document.title = seo.title;
  setCanonical(canonicalUrl);
  setNamedMeta('description', seo.description);
  setNamedMeta('keywords', seo.keywords);
  setNamedMeta('theme-color', seo.themeColor);
  setPropertyMeta('og:title', seo.title);
  setPropertyMeta('og:description', seo.description);
  setPropertyMeta('og:url', canonicalUrl);
  setPropertyMeta('og:image', SITUATED_LOGO_URL);
  setPropertyMeta('og:image:alt', 'Logo Située');
  setNamedMeta('twitter:title', seo.title);
  setNamedMeta('twitter:description', seo.description);
  setNamedMeta('twitter:image', SITUATED_LOGO_URL);
  setStructuredData(seo, canonicalUrl);
};
