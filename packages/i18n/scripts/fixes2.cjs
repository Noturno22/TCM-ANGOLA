const fs = require('fs');
const path = require('path');
const dir = __dirname + path.sep;

const data = {
  es: {
    'challenge.status.wrong': '¡Inténtalo de nuevo!',
    'challenge.hint.show': 'Mostrar pista',
    'challenge.hint.hide': 'Ocultar pista',
    'game.draw.desc': 'La posición se repitió.',
    'game.opponent_turn': 'Turno del adversario…',
    'settings.how_to_play': 'Cómo jugar',
    'profile.no_matches': 'Aún no has jugado ninguna partida.',
  },
  zh: {
    'challenge.status.wrong': '再试一次！',
    'challenge.hint.show': '显示提示',
    'challenge.hint.hide': '隐藏提示',
    'game.draw.desc': '局面重复了。',
    'game.opponent_turn': '对手回合…',
    'settings.how_to_play': '如何游戏',
    'profile.no_matches': '你还没有进行过对局。',
  },
  sw: {
    'challenge.status.wrong': 'Jaribu tena!',
    'challenge.hint.show': 'Onyesha kidokezo',
    'challenge.hint.hide': 'Ficha kidokezo',
    'game.draw.desc': 'Nafasi ilirudia.',
    'settings.how_to_play': 'Jinsi ya kucheza',
  },
  ln: {
    'challenge.status.wrong': 'Sána lisusu!',
    'challenge.hint.show': 'Lakisa litéya',
    'challenge.hint.hide': 'Bomba litéya',
    'game.draw.desc': 'Esika elongani.',
    'settings.how_to_play': 'Momekano',
  },
  kmb: {
    'challenge.status.wrong': 'Sána dingi!',
    'challenge.hint.show': 'Tangisa kulongela',
    'challenge.hint.hide': 'Visa kulongela',
    'game.draw.desc': 'Kithi kyalukile.',
    'settings.how_to_play': 'Kulongela kusána',
  },
  umb: {
    'challenge.status.wrong': 'Tanda vali!',
    'challenge.hint.show': 'Ulula okulongisa',
    'challenge.hint.hide': 'Veka okulongisa',
    'game.draw.desc': 'Okukala kwa vali.',
    'settings.how_to_play': 'Okutanda',
  },
  kg: {
    'challenge.status.wrong': 'Sana diaka!',
    'challenge.hint.show': 'Lakisa longa',
    'challenge.hint.hide': 'Bumba longa',
    'game.draw.desc': 'Kintu kivutukidi.',
    'settings.how_to_play': 'Kusana',
  },
  tch: {
    'challenge.status.wrong': 'Tanda vali!',
    'challenge.hint.show': 'Lakisa kulongisa',
    'challenge.hint.hide': 'Fisa kulongisa',
    'game.draw.desc': 'Cithi cihitile.',
    'settings.how_to_play': 'Kulongisa kutanda',
  },
  mbu: {
    'challenge.status.wrong': 'Sana vali!',
    'challenge.hint.show': 'Lakisa kufundisa',
    'challenge.hint.hide': 'Fisa kufundisa',
    'game.draw.desc': 'Cithi cipindukile.',
    'settings.how_to_play': 'Kufundisa kusana',
  },
  sh: {
    'challenge.status.wrong': 'Edza zvakare!',
    'challenge.hint.show': 'Ratidza zano',
    'challenge.hint.hide': 'Vanza zano',
    'game.draw.desc': 'Nzvimbo yakadzokorora.',
    'settings.how_to_play': 'Kutamba',
  },
  'pt-AO': {
    'challenge.status.wrong': 'Tenta outra vez!',
    'challenge.hint.show': 'Mostrar dica',
    'challenge.hint.hide': 'Esconder dica',
    'settings.how_to_play': 'Como jogar',
  },
};

for (const [lang, entries] of Object.entries(data)) {
  const file = path.join(dir, 'map-' + lang + '.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(map, entries);
  fs.writeFileSync(file, JSON.stringify(map, null, 2));
}
console.log('fixed', Object.keys(data).length, 'languages');
