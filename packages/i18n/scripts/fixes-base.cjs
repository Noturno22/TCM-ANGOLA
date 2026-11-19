const fs = require('fs');
const path = require('path');
const dir = __dirname + path.sep;

const fr = {
  'app.loading': 'Je joue avec l’Angola',
  'home.offline.desc': 'Contre l’IA ou avec un ami',
  'home.watch.desc': 'Regarde deux IAs rivaliser avec un commentaire en direct',
  'welcome.bonus': 'Bonus de bienvenue jusqu’à 5 000 KZ. Monnaie virtuelle, sans argent réel.',
  'mode.pve.desc': 'Défie l’IA. Choisis la difficulté et le camp.',
  'mode.cvc.desc': 'Mode démo. Regarde l’IA jouer.',
  'mode.difficulty': 'Difficulté de l’IA',
  'mode.side.p2.desc': 'L’IA joue en premier',
  'mode.tutorial.desc': 'Met en évidence les menaces de l’adversaire',
  'diff.easy.desc': 'Pour débutants. L’IA fait des erreurs.',
  'game.ai_thinking': 'L’IA réfléchit…',
  'game.draw.desc': 'La position s’est répétée.',
  'game.win.human': 'Tu as battu l’IA. Félicitations !',
  'game.win.ai': 'L’IA était plus forte. Réessaie !',
  'profile.no_matches': 'Tu n’as encore joué aucune partie.',
  'settings.ai_delay': 'Délai de réflexion de l’IA',
  'game.opponent_turn': 'Tour de l’adversaire…',
  'game.threat_warning': '⚠️ Menace de l’adversaire ! Bloque-la !',
  'game.lose_status': 'L’IA a gagné !',
  'challenge.status.ai': 'L’IA répond…',
  'challenge.hint.show': 'Voir l’indice',
  'challenge.hint.hide': 'Masquer l’indice',
  'challenge.today_badge': "Aujourd'hui",
  'rooms.soon.desc': 'Pour l’instant, joue hors ligne contre l’IA ou avec des amis.',
  'rooms.friends': 'Salles d’amis',
  'rooms.global_note': 'La salle globale est gratuite et sans paris. Idéale pour s’entraîner.',
  'profile.ai_levels': 'Niveaux de l’IA',
  'profile.friends.title': 'Pas encore d’amis',
  'profile.friends.desc': 'Le mode en ligne avec amis arrive bientôt. Pour l’instant, défie l’IA !',
  'profile.friends.play_ai': 'Jouer contre l’IA',
  'wallet.bonus.done': 'Tu as déjà reçu ton bonus aujourd’hui. Reviens demain !',
  'wallet.mission.streak2': 'Gagner 2 fois d’affilée',
  'wallet.no_tx': 'Aucun mouvement pour le moment.',
  'wallet.payments.soon': 'Les dépôts et retraits en ligne arrivent plus tard. Pour l’instant, le portefeuille est en lecture seule.',
  'wallet.responsible.desc': 'Tira o Cocó do Meio n’implique pas d’argent réel — toutes les pièces sont virtuelles et n’ont aucune valeur monétaire. Joue pour le plaisir.',
  'watch.desc': 'Regarde deux IAs rivaliser avec un commentaire en direct. Apprends des stratégies en regardant les maîtres jouer.',
  'watch.empty': 'Tu n’as encore aucune partie à regarder.',
  'campaign.locked_progress': 'Gagne plus de parties contre l’IA pour débloquer cette difficulté',
  'campaign_play.fail.desc': 'N’abandonne pas ! Essaie une autre stratégie.',
  'lightning.rule2': '⏱️ Chronomètre total — plus c’est rapide, mieux c’est',
  'lightning.back_home': 'Retour à l’accueil',
  'lightning.records_local': 'Les records sont conservés tant que l’application est ouverte.',
  'share.empty': 'Tu n’as encore aucune partie à partager.',
  'share.import.desc': 'L’importation de codes arrive plus tard. Pour l’instant, tu peux exporter tes parties et les voir en replay.',
  'share.how.desc': 'Chaque partie peut être résumée en un court message. Envoie-le à un ami sur WhatsApp ou SMS et invite-le à battre ton score hors ligne.',
  'share.error': 'Impossible d’ouvrir le partage. Réessaie.',
};

const en = {
  'profile.no_matches': "You haven't played any match yet.",
  'game.opponent_turn': "Opponent's turn…",
  'game.threat_warning': '⚠️ Opponent threat! Block it!',
  'challenge.today_line': "Today's challenge • +{reward} KZ",
  'replay.turn': '🟢 Player {n} turn',
  'campaign_play.fail.desc': "Don't give up! Try a different strategy.",
};

for (const [lang, entries] of Object.entries({ fr, en })) {
  const file = path.join(dir, lang + '.json');
  const dict = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(dict, entries);
  fs.writeFileSync(file, JSON.stringify(dict, null, 2));
  console.log(lang, Object.keys(dict).length);
}
