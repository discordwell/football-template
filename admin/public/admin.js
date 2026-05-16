/* ========================================
   Football Admin CMS — Client
   ======================================== */

(function () {
  'use strict';

  const API = window.location.origin;
  let token = localStorage.getItem('admin_token');
  let content = {};
  let currentSport = localStorage.getItem('admin_sport') || 'football';
  let sportsRegistry = [];

  // ---- DOM refs ----
  const loginScreen = document.getElementById('loginScreen');
  const adminPanel = document.getElementById('adminPanel');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const sidebar = document.getElementById('sidebar');
  const editor = document.getElementById('editor');
  const logoutBtn = document.getElementById('logoutBtn');
  const toastEl = document.getElementById('toast');

  // ---- Toast ----
  let toastTimer;
  function toast(msg, type = 'success') {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.className = `toast toast--${type}`;
    toastEl.hidden = false;
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3000);
  }

  // ---- API helpers ----
  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, { ...opts, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function uploadImage(file) {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`${API}/api/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  // ---- Auth ----
  async function checkAuth() {
    if (!token) return showLogin();
    try {
      await api('/api/auth/check');
      await loadContent();
      showAdmin();
    } catch {
      token = null;
      localStorage.removeItem('admin_token');
      showLogin();
    }
  }

  function showLogin() {
    loginScreen.hidden = false;
    adminPanel.hidden = true;
  }

  async function showAdmin() {
    loginScreen.hidden = true;
    adminPanel.hidden = false;
    await loadSportsRegistry();
    updateSidebarTabs();
    const sportConfig = sportsRegistry.find(s => s.slug === currentSport);
    const firstSection = sportConfig && sportConfig.sections ? sportConfig.sections[0] : 'hero';
    switchTab(firstSection);
    const viewLink = document.getElementById('viewSiteLink');
    if (viewLink) viewLink.href = '/' + currentSport;
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      token = data.token;
      localStorage.setItem('admin_token', token);
      await loadContent();
      showAdmin();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    }
  });

  logoutBtn.addEventListener('click', () => {
    token = null;
    localStorage.removeItem('admin_token');
    showLogin();
  });

  // ---- Sports registry ----
  async function loadSportsRegistry() {
    try {
      const data = await api('/api/sports');
      sportsRegistry = data.sports || [];
      const selector = document.getElementById('sportSelector');
      if (selector) {
        selector.innerHTML = sportsRegistry.map(s =>
          `<option value="${s.slug}" ${s.slug === currentSport ? 'selected' : ''}>${s.name}</option>`
        ).join('');
        selector.addEventListener('change', async (e) => {
          currentSport = e.target.value;
          localStorage.setItem('admin_sport', currentSport);
          await loadContent();
          updateSidebarTabs();
          const sportConfig = sportsRegistry.find(s => s.slug === currentSport);
          const firstSection = sportConfig && sportConfig.sections ? sportConfig.sections[0] : 'hero';
          switchTab(firstSection);
          const viewLink = document.getElementById('viewSiteLink');
          if (viewLink) viewLink.href = '/' + currentSport;
        });
      }
    } catch { /* sports registry unavailable */ }
  }

  function updateSidebarTabs() {
    const sportConfig = sportsRegistry.find(s => s.slug === currentSport);
    const sections = sportConfig && sportConfig.sections ? sportConfig.sections : [
      'affiliationBar', 'hero', 'about', 'teams', 'development',
      'competitions', 'news', 'sponsors', 'gallery', 'contact', 'footer'
    ];
    const sectionLabels = {
      affiliationBar: 'Affiliation Bar', hero: 'Hero', about: 'About',
      teams: 'Teams', development: 'Development', competitions: 'Competitions',
      news: 'News', sponsors: 'Sponsors', gallery: 'Gallery',
      contact: 'Contact', footer: 'Footer'
    };
    sidebar.innerHTML = sections.map(sec =>
      `<button class="sidebar__tab" data-section="${sec}">${sectionLabels[sec] || sec}</button>`
    ).join('') +
      '<hr class="sidebar__divider"><button class="sidebar__tab" data-section="media">Media Library</button>';
  }

  // ---- Content ----
  async function loadContent() {
    content = await api('/api/content/' + currentSport);
  }

  async function saveSection(section) {
    try {
      await api(`/api/content/${currentSport}/${section}`, {
        method: 'PUT',
        body: JSON.stringify(content[section])
      });
      toast('Saved!');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ---- Tabs ----
  let activeTab = 'hero';

  sidebar.addEventListener('click', (e) => {
    const tab = e.target.closest('.sidebar__tab');
    if (!tab) return;
    switchTab(tab.dataset.section);
  });

  function switchTab(section) {
    activeTab = section;
    sidebar.querySelectorAll('.sidebar__tab').forEach(t => {
      t.classList.toggle('sidebar__tab--active', t.dataset.section === section);
    });
    renderEditor(section);
  }

  // ---- Renderers ----
  function renderEditor(section) {
    const renderers = {
      affiliationBar: renderAffiliationBar,
      hero: renderHero,
      about: renderAbout,
      teams: renderTeams,
      development: renderDevelopment,
      competitions: renderCompetitions,
      news: renderNews,
      sponsors: renderSponsors,
      gallery: renderGallery,
      contact: renderContact,
      footer: renderFooter,
      media: renderMedia
    };
    const render = renderers[section];
    if (render) render();
  }

  function editorHeader(title, section) {
    return `<div class="editor__header">
      <h2 class="editor__title">${title}</h2>
      <button class="btn btn--save" onclick="window.__save('${section}')">Save Changes</button>
    </div>`;
  }

  // Expose save globally for onclick
  window.__save = (section) => saveSection(section);

  // ---- Image upload widget ----
  function imgWidget(currentPath, onUpload, onClear) {
    const id = 'img_' + Math.random().toString(36).slice(2, 8);
    const hasImage = !!currentPath;
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const input = el.querySelector('input[type="file"]');
      const clearBtn = el.querySelector('.img-upload__clear');
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const data = await uploadImage(file);
          onUpload(data.path);
          renderEditor(activeTab);
          toast('Image uploaded');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onClear();
          renderEditor(activeTab);
        });
      }
    }, 0);
    if (hasImage) {
      return `<div class="img-upload img-upload--has-image" id="${id}">
        <img src="${esc(currentPath)}" class="img-upload__preview" alt="">
        <button type="button" class="img-upload__clear">&times;</button>
        <input type="file" accept="image/*">
      </div>`;
    }
    return `<div class="img-upload" id="${id}">
      <span class="img-upload__text">Click or drag to upload</span>
      <span class="img-upload__hint">JPG, PNG, GIF, WebP (max 5MB)</span>
      <input type="file" accept="image/*">
    </div>`;
  }

  // ---- Affiliation Bar ----
  function renderAffiliationBar() {
    const ab = content.affiliationBar || { links: [], socials: {} };
    if (!content.affiliationBar) content.affiliationBar = ab;
    const links = ab.links || [];
    const socials = ab.socials || {};
    let html = editorHeader('Affiliation Bar', 'affiliationBar');
    html += `<div class="card">
      <div class="card__header"><h3 class="card__title">Links</h3></div>`;
    links.forEach((l, i) => {
      html += `<div class="form-row" style="margin-bottom:0.5rem">
        <div class="form-group"><label>Label</label><input type="text" value="${esc(l.label)}" data-ablink="${i}" data-key="label"></div>
        <div class="form-group"><label>URL</label><input type="url" value="${esc(l.url)}" data-ablink="${i}" data-key="url"></div>
        <button class="card__remove" data-remove-ablink="${i}">&times;</button>
      </div>`;
    });
    html += `<button class="btn btn--add" id="addAbLink">+ Add Link</button></div>`;
    html += `<div class="card">
      <div class="card__header"><h3 class="card__title">Social URLs</h3></div>
      <div class="form-group"><label>Facebook</label><input type="url" value="${esc(socials.facebook)}" data-field="facebook"></div>
      <div class="form-group"><label>Instagram</label><input type="url" value="${esc(socials.instagram)}" data-field="instagram"></div>
      <div class="form-group"><label>Twitter/X</label><input type="url" value="${esc(socials.twitter)}" data-field="twitter"></div>
    </div>`;
    editor.innerHTML = html;

    // Bind link inputs
    editor.querySelectorAll('[data-ablink]').forEach(el => {
      el.addEventListener('input', () => {
        content.affiliationBar.links[+el.dataset.ablink][el.dataset.key] = el.value;
      });
    });
    // Bind social fields
    editor.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', () => {
        if (!content.affiliationBar.socials) content.affiliationBar.socials = {};
        content.affiliationBar.socials[el.dataset.field] = el.value;
      });
    });
    // Remove link
    editor.querySelectorAll('[data-remove-ablink]').forEach(btn => {
      btn.addEventListener('click', () => {
        content.affiliationBar.links.splice(+btn.dataset.removeAblink, 1);
        renderAffiliationBar();
      });
    });
    document.getElementById('addAbLink')?.addEventListener('click', () => {
      content.affiliationBar.links.push({ label: '', url: '' });
      renderAffiliationBar();
    });
  }

  // ---- Hero ----
  function renderHero() {
    const h = content.hero || {};
    editor.innerHTML = editorHeader('Hero Section', 'hero') + `
      <div class="card">
        <div class="form-group">
          <label>Title Line 1</label>
          <input type="text" value="${esc(h.titleLine1)}" data-field="titleLine1">
        </div>
        <div class="form-group">
          <label>Title Line 2</label>
          <input type="text" value="${esc(h.titleLine2)}" data-field="titleLine2">
        </div>
        <div class="form-group">
          <label>Subtitle</label>
          <input type="text" value="${esc(h.subtitle)}" data-field="subtitle">
        </div>
        <div class="form-group">
          <label>Tagline</label>
          <input type="text" value="${esc(h.tagline)}" data-field="tagline">
        </div>
        <div class="form-group">
          <label>CTA Button Text</label>
          <input type="text" value="${esc(h.ctaText)}" data-field="ctaText">
        </div>
      </div>
      <div class="card">
        <div class="card__header"><h3 class="card__title">Background Image</h3></div>
        ${imgWidget(h.backgroundImage, (path) => { content.hero.backgroundImage = path; }, () => { content.hero.backgroundImage = null; })}
      </div>`;
    bindFields('hero', ['titleLine1', 'titleLine2', 'subtitle', 'tagline', 'ctaText']);
  }

  // ---- About ----
  function renderAbout() {
    const a = content.about || {};
    const paragraphs = a.paragraphs || [];
    const stats = a.stats || [];
    const gov = a.governance || [];

    let html = editorHeader('About Section', 'about');
    html += `<div class="card">
      <div class="card__header"><h3 class="card__title">Header</h3></div>
      <div class="form-group">
        <label>Section Label</label>
        <input type="text" value="${esc(a.label)}" data-field="label">
      </div>
      <div class="form-group">
        <label>Title (HTML allowed)</label>
        <input type="text" value="${esc(a.title)}" data-field="title">
      </div>
    </div>`;

    // Paragraphs
    html += `<div class="card">
      <div class="card__header"><h3 class="card__title">Description</h3></div>`;
    paragraphs.forEach((p, i) => {
      html += `<div class="form-group">
        <label>Paragraph ${i + 1}</label>
        <textarea data-array="paragraphs" data-index="${i}" rows="3">${esc(p)}</textarea>
        <button class="btn btn--small btn--ghost card__remove" data-remove-para="${i}">&times; Remove</button>
      </div>`;
    });
    html += `<button class="btn btn--add" id="addParagraph">+ Add Paragraph</button></div>`;

    // About image
    html += `<div class="card">
      <div class="card__header"><h3 class="card__title">Image</h3></div>
      ${imgWidget(a.image, (path) => { content.about.image = path; }, () => { content.about.image = null; })}
    </div>`;

    // Stats
    html += `<div class="card">
      <div class="card__header"><h3 class="card__title">Stats</h3></div>`;
    stats.forEach((s, i) => {
      html += `<div class="form-row form-row--3" style="margin-bottom:1rem">
        <div class="form-group"><label>Number</label><input type="text" value="${esc(s.number)}" data-stat="${i}" data-key="number"></div>
        <div class="form-group"><label>Label</label><input type="text" value="${esc(s.label)}" data-stat="${i}" data-key="label"></div>
        <div class="form-group"><label>Description</label><input type="text" value="${esc(s.desc)}" data-stat="${i}" data-key="desc"></div>
      </div>`;
    });
    html += `</div>`;

    // Governance
    html += `<div class="card">
      <div class="card__header"><h3 class="card__title">Governance</h3></div>`;
    gov.forEach((g, i) => {
      html += `<div class="form-row" style="margin-bottom:1rem">
        <div class="form-group"><label>Title</label><input type="text" value="${esc(g.title)}" data-gov="${i}" data-key="title"></div>
        <div class="form-group"><label>Name</label><input type="text" value="${esc(g.name)}" data-gov="${i}" data-key="name"></div>
      </div>`;
    });
    html += `<button class="btn btn--add" id="addGov">+ Add Position</button></div>`;

    editor.innerHTML = html;
    bindFields('about', ['label', 'title']);
    bindArrayTextareas('about', 'paragraphs');
    bindStatInputs();
    bindGovInputs();
    bindRemoveParas();

    document.getElementById('addParagraph')?.addEventListener('click', () => {
      content.about.paragraphs.push('');
      renderAbout();
    });
    document.getElementById('addGov')?.addEventListener('click', () => {
      content.about.governance.push({ title: '', name: '', photo: null });
      renderAbout();
    });
  }

  // ---- Teams ----
  function renderTeams() {
    const teams = content.teams || [];
    let html = editorHeader('Teams', 'teams');
    teams.forEach((t, i) => {
      html += `<div class="card">
        <div class="card__header">
          <h3 class="card__title">Team ${i + 1}</h3>
          <button class="card__remove" data-remove-team="${i}">&times;</button>
        </div>
        <div class="form-group">
          <label>Team Name</label>
          <input type="text" value="${esc(t.name)}" data-team="${i}" data-key="name">
        </div>
        <div class="form-group">
          <label>Header Style</label>
          <select data-team="${i}" data-key="headerStyle">
            <option value="men" ${t.headerStyle === 'men' ? 'selected' : ''}>Men</option>
            <option value="women" ${t.headerStyle === 'women' ? 'selected' : ''}>Women</option>
            <option value="youth" ${t.headerStyle === 'youth' ? 'selected' : ''}>Youth</option>
          </select>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea data-team="${i}" data-key="description" rows="3">${esc(t.description)}</textarea>
        </div>
        <div class="form-group"><label>Image</label>
          ${imgWidget(t.image, (path) => { content.teams[i].image = path; }, () => { content.teams[i].image = null; })}
        </div>
        <h4 style="margin:1rem 0 0.5rem; font-size:0.875rem; color:var(--gray-600)">Stats</h4>
        ${(t.stats || []).map((s, j) => `
          <div class="form-row" style="margin-bottom:0.5rem">
            <div class="form-group"><label>Label</label><input type="text" value="${esc(s.label)}" data-teamstat="${i}-${j}" data-key="label"></div>
            <div class="form-group"><label>Value</label><input type="text" value="${esc(s.value)}" data-teamstat="${i}-${j}" data-key="value"></div>
          </div>
        `).join('')}
      </div>`;
    });
    html += `<button class="btn btn--add" id="addTeam">+ Add Team</button>`;
    editor.innerHTML = html;
    bindTeamInputs();

    editor.querySelectorAll('[data-remove-team]').forEach(btn => {
      btn.addEventListener('click', () => {
        content.teams.splice(+btn.dataset.removeTeam, 1);
        renderTeams();
      });
    });

    document.getElementById('addTeam')?.addEventListener('click', () => {
      content.teams.push({
        name: 'New Team', description: '', headerStyle: 'men',
        stats: [{ label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }],
        image: null
      });
      renderTeams();
    });
  }

  // ---- Development ----
  function renderDevelopment() {
    const d = content.development || {};
    const programs = d.programs || [];
    let html = editorHeader('Development', 'development');
    html += `<div class="card">
      <div class="form-group"><label>Section Label</label><input type="text" value="${esc(d.label)}" data-field="label"></div>
      <div class="form-group"><label>Title</label><input type="text" value="${esc(d.title)}" data-field="title"></div>
      <div class="form-group"><label>Intro Text</label><textarea data-field="intro" rows="3">${esc(d.intro)}</textarea></div>
    </div>`;
    programs.forEach((p, i) => {
      html += `<div class="card">
        <div class="card__header">
          <h3 class="card__title">Program ${i + 1}</h3>
          <button class="card__remove" data-remove-prog="${i}">&times;</button>
        </div>
        <div class="form-group"><label>Title</label><input type="text" value="${esc(p.title)}" data-prog="${i}" data-key="title"></div>
        <div class="form-group"><label>Description</label><textarea data-prog="${i}" data-key="description" rows="2">${esc(p.description)}</textarea></div>
        <div class="form-group"><label>Status</label><input type="text" value="${esc(p.status)}" data-prog="${i}" data-key="status"></div>
      </div>`;
    });
    html += `<button class="btn btn--add" id="addProg">+ Add Program</button>`;
    editor.innerHTML = html;
    bindFields('development', ['label', 'title', 'intro']);
    bindProgInputs();

    editor.querySelectorAll('[data-remove-prog]').forEach(btn => {
      btn.addEventListener('click', () => {
        content.development.programs.splice(+btn.dataset.removeProg, 1);
        renderDevelopment();
      });
    });
    document.getElementById('addProg')?.addEventListener('click', () => {
      content.development.programs.push({ title: '', description: '', status: '' });
      renderDevelopment();
    });
  }

  // ---- Competitions ----
  function renderCompetitions() {
    const c = content.competitions || {};
    const events = c.events || [];
    let html = editorHeader('Competitions', 'competitions');
    html += `<div class="card">
      <div class="form-group"><label>Section Label</label><input type="text" value="${esc(c.label)}" data-field="label"></div>
      <div class="form-group"><label>Title</label><input type="text" value="${esc(c.title)}" data-field="title"></div>
    </div>`;
    events.forEach((ev, i) => {
      html += `<div class="card">
        <div class="card__header">
          <h3 class="card__title">Event ${i + 1}</h3>
          <button class="card__remove" data-remove-event="${i}">&times;</button>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Title</label><input type="text" value="${esc(ev.title)}" data-event="${i}" data-key="title"></div>
          <div class="form-group"><label>Badge</label><input type="text" value="${esc(ev.badge)}" data-event="${i}" data-key="badge"></div>
        </div>
        <div class="form-group">
          <label>Badge Style</label>
          <select data-event="${i}" data-key="badgeStyle">
            <option value="domestic" ${ev.badgeStyle === 'domestic' ? 'selected' : ''}>Domestic</option>
            <option value="international" ${ev.badgeStyle === 'international' ? 'selected' : ''}>International</option>
            <option value="youth" ${ev.badgeStyle === 'youth' ? 'selected' : ''}>Youth</option>
          </select>
        </div>
        <div class="form-group"><label>Description</label><textarea data-event="${i}" data-key="description" rows="2">${esc(ev.description)}</textarea></div>
        <div class="form-group"><label>Meta</label><input type="text" value="${esc(ev.meta)}" data-event="${i}" data-key="meta"></div>
      </div>`;
    });
    html += `<button class="btn btn--add" id="addEvent">+ Add Event</button>`;

    // Next Match
    const nm = c.nextMatch || {};
    html += `<div class="card" style="margin-top:1rem">
      <div class="card__header"><h3 class="card__title">Next Match</h3></div>
      <div class="form-row">
        <div class="form-group"><label>Team 1</label><input type="text" value="${esc(nm.team1)}" data-nm data-key="team1"></div>
        <div class="form-group"><label>Team 2</label><input type="text" value="${esc(nm.team2)}" data-nm data-key="team2"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Date</label><input type="text" value="${esc(nm.date)}" data-nm data-key="date"></div>
        <div class="form-group"><label>Venue</label><input type="text" value="${esc(nm.venue)}" data-nm data-key="venue"></div>
      </div>
    </div>`;

    html += `<div class="card" style="margin-top:1rem">
      <div class="form-group"><label>Results Text</label><textarea data-field="resultsText" rows="2">${esc(c.resultsText)}</textarea></div>
    </div>`;
    editor.innerHTML = html;
    bindFields('competitions', ['label', 'title', 'resultsText']);

    // Bind next match inputs
    editor.querySelectorAll('[data-nm]').forEach(el => {
      el.addEventListener('input', () => {
        if (!content.competitions.nextMatch) content.competitions.nextMatch = {};
        content.competitions.nextMatch[el.dataset.key] = el.value;
      });
    });
    bindEventInputs();

    editor.querySelectorAll('[data-remove-event]').forEach(btn => {
      btn.addEventListener('click', () => {
        content.competitions.events.splice(+btn.dataset.removeEvent, 1);
        renderCompetitions();
      });
    });
    document.getElementById('addEvent')?.addEventListener('click', () => {
      content.competitions.events.push({ title: '', badge: '', badgeStyle: 'domestic', description: '', meta: '' });
      renderCompetitions();
    });
  }

  // ---- News ----
  function renderNews() {
    const n = content.news || {};
    const featured = n.featured || {};
    const articles = n.articles || [];
    let html = editorHeader('News', 'news');

    // Featured
    html += `<div class="card">
      <div class="card__header"><h3 class="card__title">Featured Article</h3></div>
      <div class="form-group"><label>Title</label><input type="text" value="${esc(featured.title)}" data-featured data-key="title"></div>
      <div class="form-group"><label>Excerpt</label><textarea data-featured data-key="excerpt" rows="3">${esc(featured.excerpt)}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Date</label><input type="text" value="${esc(featured.date)}" data-featured data-key="date"></div>
        <div class="form-group"><label>Category</label><input type="text" value="${esc(featured.category)}" data-featured data-key="category"></div>
      </div>
      <div class="form-group"><label>Image</label>
        ${imgWidget(featured.image, (path) => { content.news.featured.image = path; }, () => { content.news.featured.image = null; })}
      </div>
    </div>`;

    // Articles
    articles.forEach((a, i) => {
      html += `<div class="card">
        <div class="card__header">
          <h3 class="card__title">Article ${i + 1}</h3>
          <button class="card__remove" data-remove-article="${i}">&times;</button>
        </div>
        <div class="form-group"><label>Title</label><input type="text" value="${esc(a.title)}" data-article="${i}" data-key="title"></div>
        <div class="form-group"><label>Excerpt</label><textarea data-article="${i}" data-key="excerpt" rows="2">${esc(a.excerpt)}</textarea></div>
        <div class="form-row form-row--3">
          <div class="form-group"><label>Date</label><input type="text" value="${esc(a.date)}" data-article="${i}" data-key="date"></div>
          <div class="form-group"><label>Category</label><input type="text" value="${esc(a.category)}" data-article="${i}" data-key="category"></div>
          <div class="form-group">
            <label>Category Style</label>
            <select data-article="${i}" data-key="categoryStyle">
              <option value="development" ${a.categoryStyle === 'development' ? 'selected' : ''}>Development</option>
              <option value="competition" ${a.categoryStyle === 'competition' ? 'selected' : ''}>Competition</option>
              <option value="partnership" ${a.categoryStyle === 'partnership' ? 'selected' : ''}>Partnership</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label>Image</label>
          ${imgWidget(a.image, (path) => { content.news.articles[i].image = path; }, () => { content.news.articles[i].image = null; })}
        </div>
      </div>`;
    });
    html += `<button class="btn btn--add" id="addArticle">+ Add Article</button>`;
    editor.innerHTML = html;
    bindFeaturedInputs();
    bindArticleInputs();

    editor.querySelectorAll('[data-remove-article]').forEach(btn => {
      btn.addEventListener('click', () => {
        content.news.articles.splice(+btn.dataset.removeArticle, 1);
        renderNews();
      });
    });
    document.getElementById('addArticle')?.addEventListener('click', () => {
      content.news.articles.push({ title: '', excerpt: '', date: '', category: '', categoryStyle: 'development', image: null });
      renderNews();
    });
  }

  // ---- Sponsors ----
  function renderSponsors() {
    const sponsors = content.sponsors || [];
    let html = editorHeader('Sponsors & Partners', 'sponsors');
    sponsors.forEach((s, i) => {
      html += `<div class="card">
        <div class="card__header">
          <h3 class="card__title">Sponsor ${i + 1}</h3>
          <button class="card__remove" data-remove-sponsor="${i}">&times;</button>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Name</label><input type="text" value="${esc(s.name)}" data-sponsor="${i}" data-key="name"></div>
          <div class="form-group"><label>URL</label><input type="url" value="${esc(s.url)}" data-sponsor="${i}" data-key="url"></div>
        </div>
        <div class="form-group"><label>Logo</label>
          ${imgWidget(s.logo, (path) => { content.sponsors[i].logo = path; }, () => { content.sponsors[i].logo = null; })}
        </div>
      </div>`;
    });
    html += `<button class="btn btn--add" id="addSponsor">+ Add Sponsor</button>`;
    editor.innerHTML = html;
    bindSponsorInputs();

    editor.querySelectorAll('[data-remove-sponsor]').forEach(btn => {
      btn.addEventListener('click', () => {
        content.sponsors.splice(+btn.dataset.removeSponsor, 1);
        renderSponsors();
      });
    });
    document.getElementById('addSponsor')?.addEventListener('click', () => {
      content.sponsors.push({ name: '', logo: null, url: '' });
      renderSponsors();
    });
  }

  // ---- Gallery ----
  function renderGallery() {
    const g = content.gallery || { label: 'Gallery', title: 'In Action', images: [] };
    if (!content.gallery) content.gallery = g;
    const images = g.images || [];
    let html = editorHeader('Gallery', 'gallery');
    html += `<div class="card">
      <div class="form-group"><label>Section Label</label><input type="text" value="${esc(g.label)}" data-field="label"></div>
      <div class="form-group"><label>Title</label><input type="text" value="${esc(g.title)}" data-field="title"></div>
    </div>`;
    images.forEach((img, i) => {
      html += `<div class="card">
        <div class="card__header">
          <h3 class="card__title">Image ${i + 1}</h3>
          <button class="card__remove" data-remove-gallery="${i}">&times;</button>
        </div>
        <div class="form-group"><label>Caption</label><input type="text" value="${esc(img.caption)}" data-gallery="${i}" data-key="caption"></div>
        <div class="form-group"><label>Image</label>
          ${imgWidget(img.src, (path) => { content.gallery.images[i].src = path; }, () => { content.gallery.images[i].src = null; })}
        </div>
      </div>`;
    });
    html += `<button class="btn btn--add" id="addGalleryImg">+ Add Image</button>`;
    editor.innerHTML = html;
    bindFields('gallery', ['label', 'title']);

    editor.querySelectorAll('[data-gallery]').forEach(el => {
      el.addEventListener('input', () => {
        content.gallery.images[+el.dataset.gallery][el.dataset.key] = el.value;
      });
    });
    editor.querySelectorAll('[data-remove-gallery]').forEach(btn => {
      btn.addEventListener('click', () => {
        content.gallery.images.splice(+btn.dataset.removeGallery, 1);
        renderGallery();
      });
    });
    document.getElementById('addGalleryImg')?.addEventListener('click', () => {
      content.gallery.images.push({ src: null, caption: '' });
      renderGallery();
    });
  }

  // ---- Contact ----
  function renderContact() {
    const c = content.contact || {};
    editor.innerHTML = editorHeader('Contact', 'contact') + `
      <div class="card">
        <div class="form-group"><label>Organization Name</label><input type="text" value="${esc(c.orgName)}" data-field="orgName"></div>
        <div class="form-group"><label>Address</label><textarea data-field="address" rows="2">${esc(c.address)}</textarea></div>
        <div class="form-group"><label>Email</label><input type="email" value="${esc(c.email)}" data-field="email"></div>
      </div>
      <div class="card">
        <div class="card__header"><h3 class="card__title">Social Links</h3></div>
        <div class="form-group"><label>Facebook URL</label><input type="url" value="${esc(c.facebook)}" data-field="facebook"></div>
        <div class="form-group"><label>Instagram URL</label><input type="url" value="${esc(c.instagram)}" data-field="instagram"></div>
        <div class="form-group"><label>Twitter/X URL</label><input type="url" value="${esc(c.twitter)}" data-field="twitter"></div>
      </div>`;
    bindFields('contact', ['orgName', 'address', 'email', 'facebook', 'instagram', 'twitter']);
  }

  // ---- Footer ----
  function renderFooter() {
    const f = content.footer || {};
    const affiliations = f.affiliations || [];
    let html = editorHeader('Footer', 'footer');
    html += `<div class="card">
      <div class="form-group"><label>Brand Name</label><input type="text" value="${esc(f.brandName)}" data-field="brandName"></div>
      <div class="form-group"><label>Copyright</label><input type="text" value="${esc(f.copyright)}" data-field="copyright"></div>
      <div class="form-group"><label>Tagline</label><input type="text" value="${esc(f.tagline)}" data-field="tagline"></div>
    </div>`;
    html += `<div class="card"><div class="card__header"><h3 class="card__title">Affiliations</h3></div>`;
    affiliations.forEach((a, i) => {
      html += `<div class="form-row form-row--3" style="margin-bottom:1rem">
        <div class="form-group"><label>Badge</label><input type="text" value="${esc(a.badge)}" data-affil="${i}" data-key="badge"></div>
        <div class="form-group"><label>Label</label><input type="text" value="${esc(a.label)}" data-affil="${i}" data-key="label"></div>
        <div class="form-group"><label>URL</label><input type="url" value="${esc(a.url)}" data-affil="${i}" data-key="url"></div>
      </div>`;
    });
    html += `<button class="btn btn--add" id="addAffil">+ Add Affiliation</button></div>`;
    editor.innerHTML = html;
    bindFields('footer', ['brandName', 'copyright', 'tagline']);
    bindAffilInputs();

    document.getElementById('addAffil')?.addEventListener('click', () => {
      content.footer.affiliations.push({ badge: '', label: '', url: '' });
      renderFooter();
    });
  }

  // ---- Media Library ----
  async function renderMedia() {
    let html = `<div class="editor__header">
      <h2 class="editor__title">Media Library</h2>
      <label class="btn btn--save" style="cursor:pointer">
        Upload Image
        <input type="file" accept="image/*" id="mediaUpload" style="display:none" multiple>
      </label>
    </div>`;
    html += `<div class="media-grid" id="mediaGrid">Loading...</div>`;
    editor.innerHTML = html;

    try {
      const files = await api('/api/uploads');
      const grid = document.getElementById('mediaGrid');
      if (files.length === 0) {
        grid.innerHTML = '<p style="color:var(--gray-400)">No images uploaded yet.</p>';
      } else {
        grid.innerHTML = files.map(f => `
          <div class="media-item">
            <img src="${esc(f.path)}" class="media-item__img" alt="${esc(f.filename)}" loading="lazy">
            <div class="media-item__info">${esc(f.filename)}</div>
            <div class="media-item__actions">
              <button class="media-item__btn" data-copy="${esc(f.path)}">Copy Path</button>
              <button class="media-item__btn media-item__btn--delete" data-delete-media="${f.filename}">Delete</button>
            </div>
          </div>
        `).join('');
      }

      grid.addEventListener('click', async (e) => {
        const copyBtn = e.target.closest('[data-copy]');
        if (copyBtn) {
          try { await navigator.clipboard.writeText(copyBtn.dataset.copy); } catch { /* fallback for insecure context */ }
          toast('Path copied');
          return;
        }
        const delBtn = e.target.closest('[data-delete-media]');
        if (delBtn) {
          if (!confirm('Delete this image?')) return;
          try {
            await api(`/api/upload/${encodeURIComponent(delBtn.dataset.deleteMedia)}`, { method: 'DELETE' });
            toast('Deleted');
            renderMedia();
          } catch (err) {
            toast(err.message, 'error');
          }
        }
      });
    } catch (err) {
      document.getElementById('mediaGrid').innerHTML = `<p style="color:var(--red-500)">${esc(err.message)}</p>`;
    }

    document.getElementById('mediaUpload')?.addEventListener('change', async (e) => {
      for (const file of e.target.files) {
        try {
          await uploadImage(file);
        } catch (err) {
          toast(err.message, 'error');
        }
      }
      toast('Upload complete');
      renderMedia();
    });
  }

  // ---- Binding helpers ----
  function bindFields(section, fields) {
    fields.forEach(field => {
      const el = editor.querySelector(`[data-field="${field}"]`);
      if (!el) return;
      el.addEventListener('input', () => {
        if (!content[section]) content[section] = {};
        content[section][field] = el.value;
      });
    });
  }

  function bindArrayTextareas(section, arrayKey) {
    editor.querySelectorAll(`[data-array="${arrayKey}"]`).forEach(el => {
      el.addEventListener('input', () => {
        content[section][arrayKey][+el.dataset.index] = el.value;
      });
    });
  }

  function bindRemoveParas() {
    editor.querySelectorAll('[data-remove-para]').forEach(btn => {
      btn.addEventListener('click', () => {
        content.about.paragraphs.splice(+btn.dataset.removePara, 1);
        renderAbout();
      });
    });
  }

  function bindStatInputs() {
    editor.querySelectorAll('[data-stat]').forEach(el => {
      el.addEventListener('input', () => {
        content.about.stats[+el.dataset.stat][el.dataset.key] = el.value;
      });
    });
  }

  function bindGovInputs() {
    editor.querySelectorAll('[data-gov]').forEach(el => {
      el.addEventListener('input', () => {
        content.about.governance[+el.dataset.gov][el.dataset.key] = el.value;
      });
    });
  }

  function bindTeamInputs() {
    editor.querySelectorAll('[data-team]').forEach(el => {
      el.addEventListener('input', () => {
        content.teams[+el.dataset.team][el.dataset.key] = el.value;
      });
      el.addEventListener('change', () => {
        content.teams[+el.dataset.team][el.dataset.key] = el.value;
      });
    });
    editor.querySelectorAll('[data-teamstat]').forEach(el => {
      el.addEventListener('input', () => {
        const [ti, si] = el.dataset.teamstat.split('-').map(Number);
        content.teams[ti].stats[si][el.dataset.key] = el.value;
      });
    });
  }

  function bindProgInputs() {
    editor.querySelectorAll('[data-prog]').forEach(el => {
      el.addEventListener('input', () => {
        content.development.programs[+el.dataset.prog][el.dataset.key] = el.value;
      });
    });
  }

  function bindEventInputs() {
    editor.querySelectorAll('[data-event]').forEach(el => {
      const handler = () => {
        content.competitions.events[+el.dataset.event][el.dataset.key] = el.value;
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  function bindFeaturedInputs() {
    editor.querySelectorAll('[data-featured]').forEach(el => {
      el.addEventListener('input', () => {
        content.news.featured[el.dataset.key] = el.value;
      });
    });
  }

  function bindArticleInputs() {
    editor.querySelectorAll('[data-article]').forEach(el => {
      const handler = () => {
        content.news.articles[+el.dataset.article][el.dataset.key] = el.value;
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  function bindSponsorInputs() {
    editor.querySelectorAll('[data-sponsor]').forEach(el => {
      el.addEventListener('input', () => {
        content.sponsors[+el.dataset.sponsor][el.dataset.key] = el.value;
      });
    });
  }

  function bindAffilInputs() {
    editor.querySelectorAll('[data-affil]').forEach(el => {
      el.addEventListener('input', () => {
        content.footer.affiliations[+el.dataset.affil][el.dataset.key] = el.value;
      });
    });
  }

  // ---- Utils ----
  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- Init ----
  checkAuth();
})();
