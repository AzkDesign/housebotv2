// --- « aide » (ou « help ») en message privé : le rappel de toutes les commandes secrètes (voir 29, 64, 65, 66 et studio.js) ---
function privateHelp() {
  const groups = Object.keys(AUTO_WORDS).map((w) => `\`${w}\``).join(", ");
  return [
    "🔐 **Commandes privées** (en message privé au bot)\n" +
      `Groupes : ${groups} — remplacez \`nina\` par le groupe voulu. Ryuk est exclu des combats, raids et îles.\n\n` +
      "🎁 **Le quotidien**\n" +
      "• `nina` : booster gratuit et quêtes du jour\n" +
      "• `nina boss` : tous les essais du boss de la semaine\n" +
      "• `nina full` : tout (booster, quêtes, boss, histoire, pass de combat, Pass Duo)\n\n" +
      "🐉 **Raid**\n" +
      "• `raid all` : tout le monde au prochain raid (combat et capture automatiques)\n" +
      "• `nina raid` : seulement ce groupe\n\n" +
      "🏝️ **Îles**\n" +
      "• `nina ile` : attaque d'une île en direct (ou prise d'une île libre), résultat en privé\n\n" +
      "🏆 **Parties classées**\n" +
      "• `ranked` : 10 min de classées entre tous (vrais fils, Charlotte gagne ses matchs)\n" +
      "• `nina clara ranked` : seulement ces groupes\n" +
      "• `rankedsee` : pareil, avec une place gardée pour 1411724649036910673",
    "🏰 **Clash de la Maison**\n" +
      "• `autoclash` / `nina autoclash` : Maisons gérées seules, ≈ 2 attaques par heure (8 par jour)\n" +
      "• `autoclash bilan` : où en est chacun\n" +
      "• `autoclash stop` / `nina autoclash stop` : arrêt\n\n" +
      "🔞 **Studio**\n" +
      "• `studio` : le bilan\n" +
      "• `studio pause` / `studio reprendre`\n" +
      "• `studio rythme lent|normal|rapide`\n" +
      "• `studio prix 20` : prix de l'abonnement\n" +
      "• `studio client Pseudo: message` : un client écrit (sans pseudo : au hasard)\n" +
      "• `studio exemples` : exemples de messages de clients\n" +
      "• `studio media` : crée le salon 📸・publications\n" +
      "• `studio fermer confirmer` : supprime le studio\n" +
      "• sur le serveur : `/studio membre:@…` crée le studio (administration)\n\n" +
      "ℹ️ `aide` ou `help` : ce message",
  ];
}
{
  const auto = handleAutoMessage;
  handleAutoMessage = async (message) => {
    const word = message.content?.trim().toLowerCase();
    if (!message.guild && !message.author?.bot && message.author?.id === AUTO_TRIGGER_ID && (word === "aide" || word === "help")) {
      for (const part of privateHelp()) await message.reply(part).catch(() => null);
      return;
    }
    return auto(message);
  };
}
