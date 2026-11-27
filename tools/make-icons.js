// Renders art/icon.svg to the home-screen icons in public/ (icon-180.png,
// -192, -512) and copies the SVG to public/icon.svg (the tab icon and the
// home screen's logo). Run after changing the icon: node tools/make-icons.js
// Needs Chrome or Edge (CHROME_PATH if it's somewhere unusual). Same as
// Order Up's game/make-icons.js.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const chrome = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => fs.existsSync(p));
if (!chrome) throw new Error('No Chrome or Edge found: set CHROME_PATH');
const svg = fs.readFileSync(path.join(__dirname, '..', 'art', 'icon.svg'), 'utf8');
const out = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(out, 'icon.svg'), svg);
console.log('wrote public/icon.svg');
for (const size of [180, 192, 512]) {
  const html = path.join(os.tmpdir(), `conduit-icon-${size}.html`);
  fs.writeFileSync(html, `<!doctype html><style>html,body{margin:0;background:#16181d}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  const file = path.join(out, `icon-${size}.png`);
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${size},${size}`, `--screenshot=${file}`, 'file:///' + html.split(path.sep).join('/')], { stdio: 'ignore' });
  console.log(`wrote public/icon-${size}.png`);
}
