/* ========================================
   League Template — app.js
   Multi-sport CMS hydration, nav, scroll-reveal
   ======================================== */

(function () {
    'use strict';

    /* ---- Determine sport from URL ---- */
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const sportSlug = pathParts[0] || 'soccer';

    const nav = document.getElementById('nav');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const navOverlay = document.getElementById('navOverlay');
    const allNavLinks = document.querySelectorAll('.nav__link');
    const sections = document.querySelectorAll('section[id]');

    /* ---- Mobile menu ---- */
    function openMenu() {
        navLinks.classList.add('nav__links--open');
        navToggle.classList.add('nav__toggle--open');
        navOverlay.classList.add('nav__overlay--visible');
        navToggle.setAttribute('aria-expanded', 'true');
        navOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        navLinks.classList.remove('nav__links--open');
        navToggle.classList.remove('nav__toggle--open');
        navOverlay.classList.remove('nav__overlay--visible');
        navToggle.setAttribute('aria-expanded', 'false');
        navOverlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    navToggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.contains('nav__links--open');
        isOpen ? closeMenu() : openMenu();
    });

    navOverlay.addEventListener('click', closeMenu);

    allNavLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });

    /* ---- Scroll-reveal ---- */
    function initReveal() {
        const reveals = document.querySelectorAll('.reveal');
        if (reveals.length > 0) {
            const revealObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('reveal--visible');
                            revealObserver.unobserve(entry.target);
                        }
                    });
                },
                { threshold: 0.1, rootMargin: '0px 0px -20px 0px' }
            );
            reveals.forEach(el => revealObserver.observe(el));
        }
    }

    /* ---- Active nav link ---- */
    if (sections.length > 0) {
        const sectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute('id');
                        allNavLinks.forEach(link => {
                            link.classList.toggle(
                                'nav__link--active',
                                link.getAttribute('href') === '#' + id
                            );
                        });
                    }
                });
            },
            { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' }
        );
        sections.forEach(section => sectionObserver.observe(section));
    }

    /* ---- Smooth scroll for nav brand ---- */
    const brand = document.querySelector('.nav__brand');
    if (brand) {
        brand.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* ========================================
       CMS Content Hydration
       ======================================== */

    function esc(str) {
        if (str == null) return '';
        const d = document.createElement('div');
        d.textContent = String(str);
        return d.innerHTML;
    }

    function setText(selector, text) {
        const el = document.querySelector(selector);
        if (el && text != null) el.textContent = text;
    }

    function hydrateAffiliationBar(data) {
        if (!data) return;
        if (data.links) {
            const container = document.getElementById('abLinks');
            if (container) {
                container.innerHTML = data.links.map(l =>
                    `<a href="${esc(l.url)}" class="affiliation-bar__link" target="_blank" rel="noopener">${esc(l.label)}</a>`
                ).join('');
            }
        }
        if (data.socials) {
            const socials = document.querySelectorAll('#abSocials .affiliation-bar__social');
            if (socials.length >= 3) {
                if (data.socials.facebook) socials[0].href = data.socials.facebook;
                if (data.socials.instagram) socials[1].href = data.socials.instagram;
                if (data.socials.twitter) socials[2].href = data.socials.twitter;
            }
        }
    }

    function hydrateHero(data) {
        if (!data) return;
        setText('.hero__title-line:first-child', data.titleLine1);
        setText('.hero__title-line--accent', data.titleLine2);
        setText('.hero__subtitle', data.subtitle);
        setText('.hero__tagline', data.tagline);
        setText('.hero__cta', data.ctaText);

        if (data.backgroundImage) {
            const bg = document.getElementById('heroBg');
            if (bg) {
                bg.style.backgroundImage = `url('${data.backgroundImage.replace(/['"()]/g, '')}')`;
                bg.classList.add('hero__bg--image');
            }
        }
    }

    function hydrateAbout(data) {
        if (!data) return;
        if (data.label) setText('#about .section__label', data.label);
        if (data.title) {
            const titleEl = document.querySelector('#about .section__title');
            if (titleEl) titleEl.innerHTML = data.title.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n/g, '<br>');
        }

        if (data.paragraphs) {
            const textEl = document.querySelector('.about__text');
            if (textEl) {
                textEl.innerHTML = data.paragraphs.map(p => `<p>${esc(p)}</p>`).join('');
            }
        }

        if (data.stats) {
            const statsEl = document.querySelector('.about__stats');
            if (statsEl) {
                statsEl.innerHTML = data.stats.map(s => `
                    <div class="stat-card">
                        <span class="stat-card__number">${esc(s.number)}</span>
                        <span class="stat-card__label">${esc(s.label)}</span>
                        <span class="stat-card__desc">${esc(s.desc)}</span>
                    </div>
                `).join('');
            }
        }

        if (data.governance) {
            const govGrid = document.getElementById('govGrid');
            if (govGrid) {
                if (data.governance.length === 0) {
                    // Hide governance section if empty
                    const govSection = govGrid.closest('.governance');
                    if (govSection) govSection.style.display = 'none';
                } else {
                    govGrid.innerHTML = data.governance.map(g => `
                        <div class="governance__card">
                            ${g.photo
                                ? `<img src="${esc(g.photo)}" alt="${esc(g.title)}" class="governance__photo" style="width:60px;height:60px;border-radius:50%;object-fit:cover;margin:0 auto 10px;">`
                                : `<div class="governance__photo-placeholder" aria-hidden="true">
                                    <svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="24" r="12" stroke="var(--accent)" stroke-width="1.5" opacity="0.4"/><path d="M10 54 C10 42 50 42 50 54" stroke="var(--accent)" stroke-width="1.5" opacity="0.4"/></svg>
                                </div>`}
                            <h4 class="governance__name">${esc(g.title)}</h4>
                            <p class="governance__role">${esc(g.name)}</p>
                        </div>
                    `).join('');
                }
            }
        }
    }

    function hydrateTeams(teams) {
        if (!teams || !teams.length) return;
        const grid = document.getElementById('teamsGrid');
        if (!grid) return;
        const icon = `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="16" stroke="white" stroke-width="2"/><path d="M20 4 L20 36 M4 20 L36 20 M8 8 L32 32 M32 8 L8 32" stroke="white" stroke-width="1" opacity="0.4"/></svg>`;
        grid.innerHTML = teams.map(t => `
            <article class="team-card reveal">
                <div class="team-card__header team-card__header--${esc(t.headerStyle || 'men')} team-card__header--placeholder">
                    ${t.image
                        ? `<img src="${esc(t.image)}" alt="${esc(t.name)}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">`
                        : `<div class="team-card__icon" aria-hidden="true">${icon}</div>`}
                    <h3 class="team-card__title">${esc(t.name)}</h3>
                </div>
                <div class="team-card__body">
                    <p>${esc(t.description)}</p>
                    <ul class="team-card__stats">
                        ${(t.stats || []).map(s =>
                            `<li><strong>${esc(s.label)}:</strong> ${esc(s.value)}</li>`
                        ).join('')}
                    </ul>
                </div>
            </article>
        `).join('');
    }

    function hydrateDevelopment(data) {
        if (!data) return;
        if (data.label) setText('#development .section__label', data.label);
        if (data.title) setText('#development .section__title', data.title);
        if (data.intro) setText('.development__intro', data.intro);

        if (data.programs) {
            const grid = document.getElementById('devGrid');
            if (!grid) return;
            const icons = [
                `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="var(--accent)" stroke-width="2"/><path d="M16 24 L22 30 L32 18" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="var(--accent)" stroke-width="2"/><path d="M24 14 L24 34 M14 24 L34 24" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round"/></svg>`,
                `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="var(--accent)" stroke-width="2"/><path d="M18 20 C18 16 30 16 30 20 M18 28 C18 32 30 32 30 28 M15 24 L33 24" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"/></svg>`,
                `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="var(--accent)" stroke-width="2"/><path d="M16 32 L16 20 L24 14 L32 20 L32 32" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="var(--accent)" stroke-width="2"/><path d="M17 30 L24 16 L31 30 Z" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round" fill="none"/></svg>`,
                `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="var(--accent)" stroke-width="2"/><circle cx="24" cy="24" r="8" stroke="var(--gold)" stroke-width="2"/><circle cx="24" cy="24" r="2" fill="var(--gold)"/></svg>`
            ];
            grid.innerHTML = data.programs.map((p, i) => `
                <div class="dev-card reveal">
                    <div class="dev-card__icon" aria-hidden="true">${icons[i % icons.length]}</div>
                    <h3 class="dev-card__title">${esc(p.title)}</h3>
                    <p class="dev-card__desc">${esc(p.description)}</p>
                    <span class="dev-card__status">${esc(p.status)}</span>
                </div>
            `).join('');
        }
    }

    function hydrateCompetitions(data) {
        if (!data) return;
        if (data.label) setText('#competitions .section__label', data.label);
        if (data.title) {
            const titleEl = document.querySelector('#competitions .section__title');
            if (titleEl) titleEl.innerHTML = data.title.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n/g, '<br>');
        }

        if (data.league) {
            const container = document.getElementById('compLeague');
            if (!container) return;

            const league = data.league;
            let html = '';

            html += `<p class="league-sponsor reveal">${esc(league.sponsor)} &bull; ${esc(league.venue)}</p>`;

            if (league.standings && league.standings.length) {
                html += `<div class="league-standings reveal">
                    <h3 class="league-standings__title">Standings</h3>
                    <div class="league-standings__wrap">
                    <table>
                        <thead><tr>
                            <th>Pos</th><th></th><th>Club</th><th>GP</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th>
                        </tr></thead>
                        <tbody>${league.standings.map(s => `
                            <tr>
                                <td>${esc(s.pos)}</td>
                                <td><img class="league-standings__logo" src="${esc(s.logo)}" alt="" loading="lazy"></td>
                                <td class="league-standings__team">${esc(s.team)}</td>
                                <td>${esc(s.gp)}</td>
                                <td>${esc(s.w)}</td>
                                <td>${esc(s.d)}</td>
                                <td>${esc(s.l)}</td>
                                <td>${s.gd > 0 ? '+' : ''}${esc(s.gd)}</td>
                                <td class="league-standings__pts">${esc(s.pts)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                    </div>
                </div>`;
            }

            if (league.results && league.results.length) {
                const resultsByWeek = league.results.reduce((acc, r) => {
                    const wk = r.week || 0;
                    (acc[wk] = acc[wk] || []).push(r);
                    return acc;
                }, {});
                const weeks = Object.keys(resultsByWeek).map(Number).sort((a, b) => b - a);
                html += `<div class="league-results reveal">
                    ${weeks.map(wk => `
                        <h3 class="league-results__title">Week ${esc(wk)} Results</h3>
                        <div class="league-results__grid">
                            ${resultsByWeek[wk].map(r => `
                                <div class="league-result">
                                    <span class="league-result__team">${esc(r.home)}</span>
                                    <span class="league-result__score">${esc(r.homeScore)} - ${esc(r.awayScore)}</span>
                                    <span class="league-result__team">${esc(r.away)}</span>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>`;
            }

            if (league.fixtures && league.fixtures.length) {
                html += `<div class="league-fixtures reveal">
                    <h3 class="league-fixtures__title">Fixtures</h3>
                    <div class="league-fixtures__grid">
                        ${league.fixtures.map(wk => `
                            <div class="league-fixtures__week${wk.played ? ' league-fixtures__week--played' : ''}">
                                <div class="league-fixtures__header">
                                    <span class="league-fixtures__wk">Week ${esc(wk.week)}</span>
                                    <span class="league-fixtures__date">${esc(wk.date)}</span>
                                </div>
                                ${wk.matches.map(m => `
                                    <div class="league-fixtures__match">
                                        <span>${esc(m[0])}</span>
                                        <span class="league-fixtures__vs">v</span>
                                        <span>${esc(m[1])}</span>
                                    </div>
                                `).join('')}
                                <div class="league-fixtures__bye">BYE: ${esc(wk.bye)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }

            if (league.teams && league.teams.length) {
                html += `<div class="league-teams reveal">
                    <h3 class="league-teams__title">Teams</h3>
                    <div class="league-teams__grid">
                        ${league.teams.map(t => `
                            <div class="league-team-card">
                                ${t.photo
                                    ? `<div class="league-team-card__photo"><img src="${esc(t.photo)}" alt="${esc(t.name)}" loading="lazy"></div>`
                                    : `<div class="league-team-card__photo league-team-card__photo--empty"></div>`}
                                <div class="league-team-card__info">
                                    <img class="league-team-card__logo" src="${esc(t.logo)}" alt="" loading="lazy">
                                    <div>
                                        <h4 class="league-team-card__name">${esc(t.name)}</h4>
                                        <span class="league-team-card__colors">${esc(t.colors)}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }

            container.innerHTML = html;
            return;
        }

        if (data.events && data.events.length) {
            const grid = document.getElementById('compGrid');
            if (!grid) return;
            grid.innerHTML = data.events.map(ev => `
                <div class="comp-card reveal">
                    <div class="comp-card__header">
                        <h3 class="comp-card__title">${esc(ev.title)}</h3>
                        <span class="comp-card__badge${ev.badgeStyle && ev.badgeStyle !== 'domestic' ? ' comp-card__badge--' + esc(ev.badgeStyle) : ''}">${esc(ev.badge)}</span>
                    </div>
                    <p class="comp-card__desc">${esc(ev.description)}</p>
                    <div class="comp-card__meta"><span>${esc(ev.meta)}</span></div>
                </div>
            `).join('');
        }
    }

    function hydrateNews(data) {
        if (!data) return;
        const featured = data.featured;
        if (featured) {
            if (featured.image) {
                const imgEl = document.querySelector('.news-hero__image');
                if (imgEl) {
                    imgEl.innerHTML = `<img src="${esc(featured.image)}" alt="${esc(featured.title)}" style="width:100%;height:100%;object-fit:cover;">`;
                }
            }
            if (featured.category) {
                const pill = document.querySelector('.news__featured .news__pill');
                if (pill) pill.textContent = featured.category;
            }
            setText('.news-hero__title', featured.title);
            setText('.news-hero__excerpt', featured.excerpt);
            setText('.news-hero__date', featured.date);
        }

        if (data.articles) {
            const grid = document.getElementById('newsGrid');
            if (!grid) return;
            grid.innerHTML = data.articles.map(a => `
                <article class="news-card reveal">
                    <div class="news-card__image">
                        ${a.image
                            ? `<img src="${esc(a.image)}" alt="${esc(a.title)}" style="width:100%;height:100%;object-fit:cover;">`
                            : `<div class="news-card__placeholder"></div>`}
                    </div>
                    <div class="news-card__content">
                        <span class="news__pill${a.categoryStyle ? ' news__pill--' + esc(a.categoryStyle) : ''}">${esc(a.category)}</span>
                        <h4 class="news-card__title">${esc(a.title)}</h4>
                        <p class="news-card__excerpt">${esc(a.excerpt)}</p>
                        <span class="news-card__date">${esc(a.date)}</span>
                    </div>
                </article>
            `).join('');
        }
    }

    function hydrateSponsors(sponsors) {
        if (!sponsors || !sponsors.length) return;
        const grid = document.getElementById('sponsorsGrid');
        if (!grid) return;
        grid.innerHTML = sponsors.map(s => {
            if (s.logo) {
                const inner = `<img src="${esc(s.logo)}" alt="${esc(s.name)}" style="max-width:100%;max-height:60px;object-fit:contain;">`;
                const url = s.url && !/^https?:\/\//i.test(s.url) ? `https://${s.url}` : s.url;
                return url
                    ? `<a href="${esc(url)}" class="sponsor-slot" target="_blank" rel="noopener">${inner}</a>`
                    : `<div class="sponsor-slot">${inner}</div>`;
            }
            return `<div class="sponsor-slot"><span class="sponsor-slot__text">${esc(s.name) || 'Partner Logo'}</span></div>`;
        }).join('');
    }

    function hydrateGallery(data) {
        if (!data) return;
        if (data.label) setText('#gallery .section__label', data.label);
        if (data.title) setText('#gallery .section__title', data.title);

        if (data.images && data.images.length > 0) {
            const grid = document.getElementById('galleryGrid');
            if (!grid) return;
            const hasImages = data.images.some(img => img.src);
            if (hasImages) {
                grid.innerHTML = data.images.filter(img => img.src).map(img => `
                    <div class="gallery__item">
                        <img src="${esc(img.src)}" alt="${esc(img.caption)}" loading="lazy">
                        ${img.caption ? `<p class="gallery__caption">${esc(img.caption)}</p>` : ''}
                    </div>
                `).join('');
            }
        }
    }

    function hydrateContact(data) {
        if (!data) return;
        const orgNameEl = document.getElementById('contactOrgName');
        const addrEl = document.getElementById('contactAddress');
        const emailLink = document.getElementById('contactEmail');

        if (orgNameEl && data.orgName) orgNameEl.textContent = data.orgName;
        if (addrEl && data.address) addrEl.innerHTML = esc(data.address).replace(/\n/g, '<br>');
        if (emailLink && data.email) {
            emailLink.textContent = data.email;
            emailLink.href = 'mailto:' + data.email;
        }

        if (data.email) {
            const form = document.getElementById('contactForm');
            if (form) form.action = 'mailto:' + data.email + (data.cc ? ',' + data.cc : '');
        }

        const socials = document.querySelectorAll('#contactSocials .contact__social');
        if (socials.length >= 3) {
            if (data.facebook) socials[0].href = data.facebook;
            if (data.instagram) socials[1].href = data.instagram;
            if (data.twitter) socials[2].href = data.twitter;
        }
    }

    function hydrateFooter(data) {
        if (!data) return;
        if (data.affiliations) {
            const container = document.getElementById('affiliations');
            if (container) {
                container.innerHTML = data.affiliations.map(a => `
                    <a href="${esc(a.url)}" class="footer__affiliation" target="_blank" rel="noopener noreferrer" aria-label="${esc(a.badge)}">
                        <span class="footer__affiliation-badge">${esc(a.badge)}</span>
                        <span class="footer__affiliation-label">${esc(a.label)}</span>
                    </a>
                `).join('');
            }
        }
        if (data.brandName) {
            const brandEl = document.querySelector('.footer__brand');
            if (brandEl) {
                const link = brandEl.querySelector('a');
                if (link) link.textContent = data.brandName;
            }
        }
        if (data.copyright) setText('.footer__copy', data.copyright);
        if (data.tagline) setText('.footer__tagline-text', data.tagline);
    }

    /* ---- Sport-aware hydration ---- */
    async function hydrateCMS() {
        try {
            // Fetch sport config and site config in parallel
            const [sportsRes, configRes] = await Promise.all([
                fetch('/api/sports'),
                fetch('/api/config')
            ]);
            const sportsData = await sportsRes.json();
            const siteConfig = configRes.ok ? await configRes.json() : {};
            const sportConfig = sportsData.sports.find(s => s.slug === sportSlug);

            if (!sportConfig) {
                window.location.href = '/';
                return;
            }

            const orgName = siteConfig.orgName || 'Sports Hub';

            // Apply sport theming
            document.body.dataset.sport = sportSlug;
            document.documentElement.style.setProperty('--accent', sportConfig.color);

            // Update page title
            document.title = sportConfig.federation + ' \u2014 ' + orgName;

            // Update nav brand
            const brandText = document.getElementById('navBrandText');
            if (brandText) brandText.textContent = sportConfig.federation;

            // Hide sections not in this sport's config
            const activeSections = sportConfig.sections || [];
            document.querySelectorAll('[data-section]').forEach(sec => {
                if (!activeSections.includes(sec.dataset.section)) {
                    sec.style.display = 'none';
                }
            });

            // Hide nav links for hidden sections
            document.querySelectorAll('[data-nav-section]').forEach(link => {
                if (!activeSections.includes(link.dataset.navSection)) {
                    link.closest('li').style.display = 'none';
                }
            });

            // Fetch content from sport-scoped endpoint
            const res = await fetch('/api/content/' + sportSlug);
            if (!res.ok) throw new Error('API unavailable');
            const content = await res.json();

            // Hydrate all sections
            hydrateAffiliationBar(content.affiliationBar);
            hydrateHero(content.hero);
            hydrateNews(content.news);
            hydrateAbout(content.about);
            hydrateTeams(content.teams);
            hydrateCompetitions(content.competitions);
            hydrateDevelopment(content.development);
            hydrateSponsors(content.sponsors);
            hydrateGallery(content.gallery);
            hydrateContact(content.contact);
            hydrateFooter(content.footer);

            // Apply site config to footer home link
            const footerHome = document.getElementById('footerHomeLink');
            if (footerHome) footerHome.textContent = orgName;

            // Single-sport mode: hide "All Sports" links
            if (!siteConfig.multiSport) {
                if (footerHome) footerHome.href = '#hero';
                document.querySelectorAll('a[href="/"]').forEach(a => {
                    if (a !== footerHome) a.style.display = 'none';
                });
            }

            // Load sport-specific extras
            if (sportConfig.extras && sportConfig.extras.includes('kickups')) {
                const kickupsEl = document.getElementById('kickups');
                if (kickupsEl) kickupsEl.style.display = '';
                const script = document.createElement('script');
                script.src = '/kickups.js';
                document.body.appendChild(script);
            }
        } catch {
            // API unavailable — page shows HTML fallback
        }
        initReveal();
    }

    hydrateCMS();
})();
