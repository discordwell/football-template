/* ========================================
   League Template — Multi-Sport Hub
   landing.js
   ======================================== */

const SPORT_ICONS = {
    football:      '\u26BD',
    weightlifting: '\uD83C\uDFCB\uFE0F',
    athletics:     '\uD83C\uDFC3',
    volleyball:    '\uD83C\uDFD0',
    boxing:        '\uD83E\uDD4A',
    tennis:        '\uD83C\uDFBE',
    'table-tennis':'\uD83C\uDFD3',
    rugby:         '\uD83C\uDFC9',
    badminton:     '\uD83C\uDFF8',
    'touch-rugby': '\uD83C\uDFC9',
    basketball:    '\uD83C\uDFC0',
    taekwondo:     '\uD83E\uDD4B',
    swimming:      '\uD83C\uDFCA',
    netball:       '\uD83C\uDFD0',
    teqball:       '\u26BD',
};

/**
 * Render a single sport card.
 * Featured sports get a larger card with a badge.
 */
function createCard(sport) {
    const card = document.createElement('a');
    card.href = `/${sport.slug}`;
    card.className = 'card' + (sport.featured ? ' card--featured' : '');

    // Set accent color as a CSS variable so hover effects can reference it
    const accent = sport.color || '#009FDB';
    card.style.setProperty('--card-accent', accent);

    const icon = SPORT_ICONS[sport.slug] || SPORT_ICONS[sport.icon] || '\uD83C\uDFC5';

    card.innerHTML = `
        ${sport.featured ? '<span class="card__badge">Featured</span>' : ''}
        <span class="card__icon">${icon}</span>
        <h3 class="card__name">${sport.name}</h3>
        <p class="card__federation">${sport.federation || ''}</p>
        <span class="card__arrow">&rarr;</span>
    `;

    return card;
}

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

/**
 * Hydrate the landing page shell from site config.
 */
async function hydrateConfig() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) return;
        const cfg = await res.json();

        // Single-sport mode: skip landing page, go straight to football
        if (!cfg.multiSport) {
            window.location.replace('/football');
            return;
        }

        document.title = (cfg.orgName || 'Sports Hub') + ' — Sports Hub';

        const badge = document.getElementById('heroBadge');
        if (badge) badge.textContent = cfg.umbrellaAbbreviation || cfg.orgAbbreviation || '';

        const title = document.getElementById('heroTitle');
        if (title) title.textContent = cfg.heroTitle || cfg.orgName || 'SPORTS HUB';

        const tagline = document.getElementById('heroTagline');
        if (tagline) tagline.textContent = cfg.heroSubtitle || '';

        const subtitle = document.getElementById('heroSubtitle');
        if (subtitle) subtitle.textContent = cfg.description || cfg.tagline || '';

        const brand = document.getElementById('footerBrand');
        if (brand) brand.textContent = cfg.orgName || 'Sports Hub';

        const text = document.getElementById('footerText');
        if (text && cfg.umbrellaBody) {
            const loc = cfg.location || {};
            text.innerHTML = esc(cfg.umbrellaBody) + '<br>' +
                esc([loc.city, loc.country, loc.region].filter(Boolean).join(', '));
        }

        const copy = document.getElementById('footerCopy');
        if (copy && cfg.copyright) {
            copy.textContent = `\u00A9 ${cfg.copyright.year || new Date().getFullYear()} ${cfg.copyright.holder || cfg.orgName}. All rights reserved.`;
        }

        // Update OG tags for SPA navigations
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.content = cfg.orgName || '';
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.content = cfg.tagline || cfg.description || '';
    } catch {
        // Config unavailable — page shows HTML fallback
    }
}

/**
 * Fetch sports from the API and render the grid.
 */
async function init() {
    const grid = document.getElementById('sportsGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/sports');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const sports = data.sports || [];

        grid.innerHTML = '';

        // Put featured sport(s) first
        const sorted = [...sports].sort((a, b) => {
            if (a.featured && !b.featured) return -1;
            if (!a.featured && b.featured) return 1;
            return 0;
        });

        sorted.forEach(sport => {
            grid.appendChild(createCard(sport));
        });
    } catch (err) {
        console.error('Failed to load sports:', err);
        grid.innerHTML = '<p class="sports__error">Unable to load federations. Please try again later.</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    hydrateConfig();
    init();
});
