const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3200;
const DATA_DIR = path.join(__dirname, 'data');
const SPORTS_FILE = path.join(DATA_DIR, 'sports.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

// Load site config
let siteConfig = { site: {}, features: {} };
try {
  siteConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} catch (err) {
  console.warn('Warning: config.json not found, using defaults. Run "npm run setup" to configure.');
}

// Config from env
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || bcrypt.hashSync('changeme', 10);
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// ---- GitHub sync (fire-and-forget) ----
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

function githubApi(method, apiPath, body) {
  if (!GITHUB_TOKEN) return Promise.resolve(null);
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'league-admin-cms',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(postData ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {})
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    if (postData) req.write(postData);
    req.end();
  });
}

async function syncFileToGithub(repoPath, content, message) {
  if (!GITHUB_TOKEN) return;
  try {
    const apiPath = `/repos/${GITHUB_REPO}/contents/${repoPath}`;
    const existing = await githubApi('GET', `${apiPath}?ref=${GITHUB_BRANCH}`);
    const sha = existing && existing.sha ? existing.sha : undefined;
    const body = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {})
    };
    await githubApi('PUT', apiPath, body);
  } catch (err) { console.error(`GitHub sync (file) failed: ${err.message}`); }
}

async function syncBinaryToGithub(repoPath, filePath, message) {
  if (!GITHUB_TOKEN) return;
  try {
    const fileData = fs.readFileSync(filePath);
    const apiPath = `/repos/${GITHUB_REPO}/contents/${repoPath}`;
    const existing = await githubApi('GET', `${apiPath}?ref=${GITHUB_BRANCH}`);
    const sha = existing && existing.sha ? existing.sha : undefined;
    const body = {
      message,
      content: fileData.toString('base64'),
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {})
    };
    await githubApi('PUT', apiPath, body);
  } catch (err) { console.error(`GitHub sync (binary) failed: ${err.message}`); }
}

async function deleteFileFromGithub(repoPath, message) {
  if (!GITHUB_TOKEN) return;
  try {
    const apiPath = `/repos/${GITHUB_REPO}/contents/${repoPath}`;
    const existing = await githubApi('GET', `${apiPath}?ref=${GITHUB_BRANCH}`);
    if (!existing || !existing.sha) return;
    await githubApi('DELETE', apiPath, {
      message,
      sha: existing.sha,
      branch: GITHUB_BRANCH
    });
  } catch (err) { console.error(`GitHub sync (delete) failed: ${err.message}`); }
}

// Serialize content syncs to prevent SHA conflicts from rapid saves
let contentSyncQueue = Promise.resolve();
const GITHUB_CONTENT_PREFIX = process.env.GITHUB_CONTENT_PREFIX || 'admin/data';
const GITHUB_UPLOADS_PREFIX = process.env.GITHUB_UPLOADS_PREFIX || 'admin/uploads';
function queueContentSync(sport, content, section) {
  contentSyncQueue = contentSyncQueue.then(() =>
    syncFileToGithub(
      `${GITHUB_CONTENT_PREFIX}/content_${sport}.json`,
      JSON.stringify(content, null, 2),
      `cms(${sport}): update ${section}`
    )
  ).catch(() => {});
}

// Ensure dirs exist
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---- Sport + Content helpers ----
function readSports() {
  try {
    return JSON.parse(fs.readFileSync(SPORTS_FILE, 'utf8'));
  } catch {
    return { sports: [] };
  }
}

function validSport(slug) {
  const registry = readSports();
  return registry.sports.some(s => s.slug === slug);
}

function dataFile(sport) {
  const slug = (sport || 'football').replace(/[^a-z0-9-]/g, '');
  return path.join(DATA_DIR, `content_${slug}.json`);
}

function readContent(sport) {
  try {
    return JSON.parse(fs.readFileSync(dataFile(sport), 'utf8'));
  } catch {
    return {};
  }
}

function writeContent(sport, data) {
  const f = dataFile(sport);
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, f);
}

// Valid section names
const VALID_SECTIONS = [
  'affiliationBar', 'hero', 'about', 'teams', 'development',
  'competitions', 'news', 'sponsors', 'gallery', 'contact', 'footer'
];

// Middleware
app.use(express.json({ limit: '2mb' }));

// CORS — derived from config.json domain
const domain = (siteConfig.site && siteConfig.site.domain) || 'localhost:3200';
const ALLOWED_ORIGINS = [
  `https://${domain}`,
  `https://www.${domain}`,
  `http://localhost:${PORT}`
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Serve admin panel
app.use('/admin', express.static(path.join(__dirname, 'public')));

// Serve uploaded images
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9_-]/gi, '_')
      .substring(0, 50);
    const unique = Date.now().toString(36);
    cb(null, `${name}-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ---- Auth middleware ----
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ---- Routes ----

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username !== ADMIN_USER || !bcrypt.compareSync(password, ADMIN_PASS_HASH)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

// Check auth status
app.get('/api/auth/check', auth, (req, res) => {
  res.json({ ok: true, user: req.user.user });
});

// Site config (public — non-secret identity fields)
app.get('/api/config', (req, res) => {
  res.json(siteConfig.site || {});
});

// Sports registry (public)
app.get('/api/sports', (req, res) => {
  res.json(readSports());
});

// Get all content for a sport, or backward-compat section lookup
// Handles: GET /api/content/soccer → full soccer content
//          GET /api/content/hero   → soccer hero section (backward compat)
app.get('/api/content/:sportOrSection', (req, res) => {
  const param = req.params.sportOrSection;
  if (validSport(param)) {
    return res.json(readContent(param));
  }
  // Backward compat: treat as section name for soccer
  if (VALID_SECTIONS.includes(param)) {
    const content = readContent('football');
    return res.json(content[param] || {});
  }
  res.status(400).json({ error: 'Invalid sport or section' });
});

// Get single section for a sport (public)
app.get('/api/content/:sport/:section', (req, res) => {
  const { sport, section } = req.params;
  if (!validSport(sport)) {
    return res.status(400).json({ error: 'Invalid sport' });
  }
  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ error: 'Invalid section' });
  }
  const content = readContent(sport);
  res.json(content[section] || {});
});

// Backward compat: get all soccer content
app.get('/api/content', (req, res) => {
  res.json(readContent('football'));
});

// Update a section for a sport (auth required)
app.put('/api/content/:sport/:section', auth, (req, res) => {
  const { sport, section } = req.params;
  if (!validSport(sport)) {
    return res.status(400).json({ error: 'Invalid sport' });
  }
  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ error: 'Invalid section' });
  }
  const content = readContent(sport);
  content[section] = req.body;
  writeContent(sport, content);
  res.json({ ok: true, sport, section });
  queueContentSync(sport, content, section);
});

// Backward compat: update soccer section
app.put('/api/content/:section', auth, (req, res) => {
  const { section } = req.params;
  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({ error: 'Invalid section' });
  }
  const content = readContent('football');
  content[section] = req.body;
  writeContent('football', content);
  res.json({ ok: true, section });
  queueContentSync('football', content, section);
});

// Upload image (auth required)
app.post('/api/upload', auth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const filename = req.file.filename;
  res.json({
    ok: true,
    filename,
    path: `/uploads/${filename}`,
    size: req.file.size
  });
  syncBinaryToGithub(
    `${GITHUB_UPLOADS_PREFIX}/${filename}`,
    path.join(UPLOADS_DIR, filename),
    `cms: upload ${filename}`
  );
});

// List uploaded images (auth required)
app.get('/api/uploads', auth, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR)
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(UPLOADS_DIR, f));
        return { filename: f, path: `/uploads/${f}`, size: stat.size, modified: stat.mtime };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json(files);
  } catch {
    res.json([]);
  }
});

// Delete uploaded image (auth required)
app.delete('/api/upload/:filename', auth, (req, res) => {
  const filename = req.params.filename.replace(/[^a-z0-9._-]/gi, '');
  const filepath = path.resolve(UPLOADS_DIR, filename);
  if (!filepath.startsWith(UPLOADS_DIR + path.sep)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  fs.unlinkSync(filepath);
  res.json({ ok: true });
  deleteFileFromGithub(
    `${GITHUB_UPLOADS_PREFIX}/${filename}`,
    `cms: delete ${filename}`
  );
});

// Multer error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  const orgName = (siteConfig.site && siteConfig.site.orgName) || 'League';
  console.log(`${orgName} admin server running on port ${PORT}`);
  console.log(`GitHub sync: ${GITHUB_TOKEN && GITHUB_REPO ? 'enabled' : 'disabled'}`);
  const sports = readSports();
  console.log(`Sports registered: ${sports.sports.length}`);
});
