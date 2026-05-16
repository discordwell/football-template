#!/usr/bin/env node
/**
 * Interactive setup for the League Template.
 * Generates config.json, .env, and updates sample data with your org details.
 *
 * Usage: node scripts/setup.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const ENV_PATH = path.join(ROOT, '.env');
const SPORTS_PATH = path.join(ROOT, 'admin', 'data', 'sports.json');
const SITE_DIR = path.join(ROOT, 'site');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultVal) {
  const prompt = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `;
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      resolve(answer.trim() || defaultVal || '');
    });
  });
}

async function main() {
  console.log('\n=== League Template Setup ===\n');

  const orgName = await ask('Organization name (e.g. "Samoa Football Federation")');
  const orgAbbreviation = await ask('Abbreviation (e.g. "SFF")', orgName.split(' ').map(w => w[0]).join('').toUpperCase());
  const umbrellaBody = await ask('Umbrella sports body (e.g. "Samoa Association of Sports and NOC")', 'National Olympic Committee');
  const umbrellaAbbreviation = await ask('Umbrella abbreviation (e.g. "SASNOC")', 'NOC');
  const domain = await ask('Domain (e.g. "samoafootball.com")', 'localhost:3200');
  const city = await ask('City (e.g. "Apia")', 'Capital City');
  const country = await ask('Country (e.g. "Samoa")', 'Your Country');
  const region = await ask('Region (e.g. "South Pacific")', '');
  const email = await ask('Contact email', `info@${domain}`);
  const adminPassword = await ask('Admin panel password', 'changeme');
  const multiSportAnswer = await ask('Enable multi-sport mode? (y/n)', 'n');
  const multiSport = multiSportAnswer.toLowerCase().startsWith('y');

  // Generate config.json
  const config = {
    site: {
      orgName,
      orgAbbreviation,
      umbrellaBody,
      umbrellaAbbreviation,
      domain,
      tagline: `Sport Across ${country}`,
      heroTitle: country.toUpperCase(),
      heroSubtitle: multiSport ? 'National Federations. One Team.' : `The beautiful game in ${country}`,
      description: multiSport ? `Sport across ${country}` : `Football in ${country}`,
      location: { city, country, region },
      contact: { email, address: `${city}\n${country}` },
      social: { facebook: '', instagram: '', twitter: '' },
      copyright: { year: new Date().getFullYear(), holder: orgName }
    },
    features: { multiSport, githubSync: false }
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
  console.log(`\n  Written: config.json`);

  // Generate .env
  let bcryptHash;
  try {
    const bcrypt = require(path.join(ROOT, 'admin', 'node_modules', 'bcryptjs'));
    bcryptHash = bcrypt.hashSync(adminPassword, 10);
  } catch {
    // bcryptjs not installed yet — store plaintext note
    bcryptHash = `NEEDS_HASH_RUN_npm_install_FIRST`;
    console.log('  Note: Run "npm install" then re-run setup to hash the admin password.');
  }

  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const envContent = [
    '# Admin credentials',
    'ADMIN_USER=admin',
    `ADMIN_PASS_HASH=${bcryptHash}`,
    '',
    '# Server',
    'PORT=3200',
    `JWT_SECRET=${jwtSecret}`,
    '',
    '# GitHub sync (optional — leave empty to disable)',
    'GITHUB_TOKEN=',
    'GITHUB_REPO=',
    'GITHUB_BRANCH=main',
    ''
  ].join('\n');

  fs.writeFileSync(ENV_PATH, envContent, 'utf8');
  console.log(`  Written: .env`);

  // Update sports.json federation names
  try {
    const sports = JSON.parse(fs.readFileSync(SPORTS_PATH, 'utf8'));
    sports.sports.forEach(sport => {
      sport.federation = sport.federation.replace(/Example/g, country);
    });
    fs.writeFileSync(SPORTS_PATH, JSON.stringify(sports, null, 2) + '\n', 'utf8');
    console.log('  Updated: admin/data/sports.json');
  } catch { /* skip if file missing */ }

  // Update content files with org-specific info
  const dataDir = path.join(ROOT, 'admin', 'data');
  const contentFiles = fs.readdirSync(dataDir).filter(f => f.startsWith('content_') && f.endsWith('.json'));
  for (const file of contentFiles) {
    try {
      let raw = fs.readFileSync(path.join(dataDir, file), 'utf8');
      raw = raw.replace(/Example/g, country);
      raw = raw.replace(/Capital City/g, city);
      raw = raw.replace(/Your Country/g, country);
      raw = raw.replace(/YOUR NATION/g, country.toUpperCase());
      raw = raw.replace(/yourdomain\.com/g, domain);
      fs.writeFileSync(path.join(dataDir, file), raw, 'utf8');
    } catch { /* skip */ }
  }
  console.log(`  Updated: ${contentFiles.length} content file(s)`);

  // Update OG meta tags in HTML files
  const htmlFiles = ['index.html', 'sport.html'];
  for (const file of htmlFiles) {
    const htmlPath = path.join(SITE_DIR, file);
    try {
      let html = fs.readFileSync(htmlPath, 'utf8');
      html = html.replace(/content="Sports Hub"/g, `content="${orgName}"`);
      html = html.replace(/content="National Federations\. One Team\. Sport across our nation\."/g,
        `content="${config.site.tagline}"`);
      html = html.replace(/content="Multi-sport hub .* one place\."/g,
        `content="${orgName} — ${config.site.tagline}"`);
      if (domain !== 'localhost:3200') {
        html = html.replace(/content=""/, `content="https://${domain}/"`);
      }
      fs.writeFileSync(htmlPath, html, 'utf8');
    } catch { /* skip */ }
  }
  console.log('  Updated: OG meta tags in site HTML');

  console.log('\n  Setup complete! Run "npm install && npm start" to launch.\n');
  rl.close();
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  rl.close();
  process.exit(1);
});
