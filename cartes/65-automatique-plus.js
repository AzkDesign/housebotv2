// --- Message privé de AUTO_TRIGGER_ID : raid et île en automatique (voir 29-automatique) ---
// « raid all » : tous les membres de AUTO_WORDS au prochain raid · « nina raid » : seulement ce groupe (voir 61-raids)
// « nina ile » : chaque membre du groupe attaque une île, en direct dans un vrai fil ; le pilote joue ses coups
// (super dès qu'il est chargé, sinon attaque). Une île libre est prise directement. Le résultat part en privé.
async function autoIslandFor(client, userId) {
  const name = pseudo(userId), mine = islandOf(userId), now = Date.now();
  if (mine) return `🏝️ **${name}** garde déjà l'${ISLANDS[mine].name} (une seule île par membre)`;
  if (userBattle.has(userId)) return `🏝️ **${name}** est déjà en combat`;
  const keys = bestTeam(userId);
  if (!keys.length) return `🏝️ **${name}** n'a aucune carte`;
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return `🏝️ **${name}** introuvable`;
  const st = islandsState(), own = new Set(Object.values(AUTO_WORDS).flat());
  const open = Object.keys(ISLANDS).filter((id) => {
    const isl = st[id];
    return isl.holder && isl.holder !== userId && !islandFights.has(id) && (isl.protectUntil ?? 0) <= now && (isl.revenge?.[userId] ?? 0) <= now && (isl.cooldown?.[userId] ?? 0) + ISLAND_COOLDOWN <= now;
  });
  if (!open.length) {
    // pas d'île à attaquer : une île libre est prise tout de suite, comme en posant ses cartes
    const free = Object.keys(ISLANDS).find((id) => !st[id].holder);
    if (!free) return `🏝️ **${name}** : aucune île attaquable pour l'instant (protégées, en combat ou en attente)`;
    setHolder(free, { id: userId, name, avatar: user.displayAvatarURL?.({ extension: "png", size: 128 }) ?? null }, keys);
    ustat(userId, "islands");
    save();
    checkAchievements(userId).catch(() => null);
    await islandNotice(`${ISLANDS[free].emoji} <@${userId}> s'installe sur l'**${ISLANDS[free].name}**, restée libre. Qui osera l'attaquer ?`, [userId]);
    return `🏝️ **${name}** prend l'${ISLANDS[free].name}, qui était libre`;
  }
  // de préférence une île gardée par quelqu'un d'extérieur au groupe
  const others = open.filter((id) => !own.has(st[id].holder)), list = others.length ? others : open;
  const id = list[Math.floor(Math.random() * list.length)], isl = st[id], def = ISLANDS[id];
  islandFights.set(id, "?");
  const holderUser = await client.users.fetch(isl.holder).catch(() => client.user);
  const b = await startBattle(client, { user, name }, { user: holderUser, name: `${def.emoji} ${def.short} · ${islandOwnerName(isl)}`, isAI: true }, { island: id, aiLevel: ISLAND_AI, aiLabel: `Défense de l'${def.name}` });
  islandsDirty = true;
  if (!b) {
    islandFights.delete(id);
    return `🏝️ **${name}** : impossible de lancer l'attaque de l'${def.name}`;
  }
  islandFights.set(id, b.id);
  b.pilot = [0];
  b.autoReport = true;
  rankedPilot(client, b);
  return `🏝️ **${name}** attaque l'${def.name} (gardée par ${islandOwnerName(isl)}) : ${b.message?.url ?? ""}`;
}
{
  // le résultat d'une attaque automatique part en privé
  const finish = finishBattle;
  finishBattle = async (client, b, winner, reason) => {
    const already = b.phase === "over";
    await finish(client, b, winner, reason);
    if (already || !b.autoReport || !b.island) return;
    const def = ISLANDS[b.island], p = b.players[0];
    client.users
      .fetch(AUTO_TRIGGER_ID)
      .then((u) => u.send(winner === 0 ? `🏝️ **${p.name}** a pris l'**${def.name}** en ${b.round} manches !` : `🏝️ **${p.name}** a échoué contre l'**${def.name}** (${b.round} manches).`))
      .catch(() => null);
  };
  const auto = handleAutoMessage;
  handleAutoMessage = async (message) => {
    const words = message.guild || message.author?.bot || message.author?.id !== AUTO_TRIGGER_ID ? [] : message.content.trim().toLowerCase().split(/\s+/);
    const [word, action] = words;
    const all = word === "raid" && action === "all" && words.length === 2;
    const group = words.length === 2 && AUTO_WORDS[word] && (action === "raid" || action === "ile" || action === "île");
    if (!all && !group) return auto(message);
    const ids = all ? [...new Set(Object.values(AUTO_WORDS).flat())] : AUTO_WORDS[word];
    const lines = [];
    if (all || action === "raid") for (const id of ids) lines.push(`**${pseudo(id)}** — ${raidAutoEnroll(id)}`);
    else for (const id of ids) lines.push(await autoIslandFor(message.client, id).catch((err) => `🏝️ **${pseudo(id)}** : erreur (${err.message})`));
    await message.reply(`✅ Fait :\n${lines.join("\n")}`.slice(0, 1990)).catch(() => null);
  };
}
