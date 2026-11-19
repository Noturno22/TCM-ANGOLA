const fs = require('fs');
const path = require('path');
const dir = __dirname + path.sep;
const pt = JSON.parse(fs.readFileSync(dir + 'pt.json', 'utf8'));
const en = JSON.parse(fs.readFileSync(dir + 'en.json', 'utf8'));
const enByValue = {};
for (const [k, v] of Object.entries(en)) enByValue[v.toLowerCase()] = k;

const langs = ['es', 'zh', 'pt-AO', 'sw', 'ln', 'kmb', 'umb', 'kg', 'tch', 'mbu', 'sh'];
const ptValues = Object.values(pt).join(' | ').toLowerCase();

for (const lang of langs) {
  const file = path.join(dir, 'map-' + lang + '.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dead = Object.keys(map.__phrases__).filter((k) => !ptValues.includes(k.toLowerCase()));
  for (const phrase of dead) {
    const key = enByValue[phrase.toLowerCase()];
    if (key && !map[key]) map[key] = map.__phrases__[phrase];
  }
  fs.writeFileSync(file, JSON.stringify(map, null, 2));
  console.log(lang, 'dead:', dead.length, 'fixed:', dead.filter((p) => enByValue[p.toLowerCase()]).length);
}
