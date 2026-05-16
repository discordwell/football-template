# Football League Template

A reusable, CMS-powered website template for national and local sports federations. Built for FIFA-affiliated leagues but works for any multi-sport organization.

**Live example:** [teamtuvalu.tv](https://teamtuvalu.tv) (Tuvalu's national sports hub, built with this template)

## Features

- Multi-sport hub with a landing page and per-sport pages
- CMS admin panel with JWT authentication
- Per-sport content management: hero, news, about, teams, competitions, development, sponsors, gallery, contact
- Section visibility toggles per sport (not all sports need all sections)
- Sport-specific accent color theming
- Image upload and media library
- Optional GitHub sync (auto-commits CMS changes to your repo)
- Mobile responsive
- Keepie-uppie mini-game Easter egg for football pages

## Quick Start

```bash
# 1. Clone the template
git clone https://github.com/discordwell/football-template.git
cd football-template

# 2. Install dependencies
cd admin && npm install && cd ..

# 3. Run the setup wizard
npm run setup

# 4. Start the server
npm start
```

Then open [http://localhost:3200](http://localhost:3200) for the site and [http://localhost:3200/admin](http://localhost:3200/admin) for the CMS.

Default login: `admin` / `changeme` (change this during setup).

## Project Structure

```
football-template/
  config.json              # Site identity (org name, domain, location)
  .env                     # Secrets (admin password, JWT, GitHub token)
  package.json             # npm start, npm run setup, npm test
  admin/
    server.js              # Express API + CMS backend
    server.test.js         # Tests
    package.json           # Dependencies
    public/                # Admin panel UI
    data/                  # Content JSON files (one per sport)
    uploads/               # User-uploaded images
  site/
    index.html             # Landing page (sports grid)
    sport.html             # Sport page template (CMS-hydrated)
    landing.js / landing.css
    app.js / styles.css
    kickups.js             # Keepie-uppie game
  scripts/
    setup.js               # Interactive setup wizard
  deploy/
    Caddyfile.example      # Caddy reverse proxy config
    admin.service.example  # systemd service file
```

## Configuration

### config.json

Site identity — edit directly or re-run `npm run setup`:

```json
{
  "site": {
    "orgName": "Samoa Football Federation",
    "orgAbbreviation": "SFF",
    "umbrellaBody": "Samoa Association of Sports and NOC",
    "umbrellaAbbreviation": "SASNOC",
    "domain": "samoafootball.com",
    "tagline": "Sport Across Samoa",
    ...
  }
}
```

### Adding/Removing Sports

Edit `admin/data/sports.json` to add or remove sports. Each sport needs:

```json
{
  "slug": "rugby",
  "name": "Rugby",
  "federation": "Your Rugby Union",
  "abbreviation": "YRU",
  "color": "#264653",
  "icon": "rugby",
  "featured": false,
  "sections": ["hero", "about", "gallery", "contact", "footer"],
  "extras": []
}
```

Then create a matching `admin/data/content_rugby.json` with content for each enabled section.

### Available Sections

`affiliationBar`, `hero`, `news`, `about`, `teams`, `competitions`, `development`, `sponsors`, `gallery`, `contact`, `footer`

### GitHub Sync (Optional)

To auto-commit CMS changes to your GitHub repo:

1. Set `GITHUB_TOKEN` and `GITHUB_REPO` in `.env`
2. Set `"githubSync": true` in `config.json`

## Deployment

See `deploy/Caddyfile.example` and `deploy/admin.service.example` for production setup with Caddy and systemd.

Basic steps:

1. Copy project to your server
2. Run `npm run setup` with your production domain
3. Copy and edit the Caddyfile example
4. Copy and edit the systemd service example
5. `sudo systemctl start league-admin`

## License

MIT
