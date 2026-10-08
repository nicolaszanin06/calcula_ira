// Run before publishing so browsers fetch the matching CSS, scripts and logo.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = __dirname;
const indexPath = path.join(root, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
for (const asset of ['styles.css', 'calculator.js', 'progress.js', 'pdf-import.js', 'app.js', 'assets/calculaira-logo.png']) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, asset))).digest('hex').slice(0, 12);
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match either a closing tag or more attributes after the URL.
  const reference = new RegExp(`(\\b(?:src|href)=")${escaped}(?:\\?v=[^"]*)?(")`, 'g');
  if (!reference.test(html)) throw new Error(`Referência não encontrada: ${asset}`);
  html = html.replace(reference, (_, prefix, suffix) => `${prefix}${asset}?v=${hash}${suffix}`);
}
fs.writeFileSync(indexPath, html);
console.log('CSS, scripts e logo versionados pelo conteúdo.');
