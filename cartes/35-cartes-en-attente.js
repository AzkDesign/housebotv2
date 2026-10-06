
// --- Cartes en attente : rien n'entre dans les cartes sans l'accord d'un gérant ---
// La liste des membres et des entreprises qui ont une carte est figée. Un nouveau membre (rôle des membres)
// ou une nouvelle entreprise est mis de côté pour une génération future ; un gérant peut l'ajouter avec /generation.
function cardRoster() {
  return load().cardRoster ?? null;
}
const cardPending = () => (load().cardPending ??= { members: {}, companies: {} });
function activeCompanyList() {
  try {
    return require("./entreprises").listActiveCompanies();
  } catch {
    return null;
  }
}
// au démarrage : la liste actuelle devient celle de la génération en cours (une seule fois)
function freezeCardRoster() {
  const st = load();
  st.cardRoster ??= {};
  if (!st.cardRoster.members) st.cardRoster.members = Object.keys(st.memberArchive ?? {});
  if (!st.cardRoster.companies) {
    const list = activeCompanyList();
    if (list) st.cardRoster.companies = list.map((c) => String(c.id));
  }
  save();
}
// aucun log : les cartes de la prochaine génération restent une surprise (seul /generation les montre aux gérants)
// nouveau membre avec le rôle : mis en attente au lieu de devenir une carte
function rosterNoteMember(id, name) {
  const r = cardRoster();
  if (!r?.members || r.members.includes(id)) return;
  const p = cardPending();
  if (p.members[id]) return;
  p.members[id] = { name, at: Date.now() };
  save();
}
function rosterCheckCompanies() {
  const r = cardRoster(), list = activeCompanyList();
  if (!r?.companies || !list) return;
  const p = cardPending();
  for (const co of list) {
    const id = String(co.id);
    if (r.companies.includes(id) || p.companies[id]) continue;
    p.companies[id] = { name: co.name, at: Date.now() };
    save();
  }
}
{
  // seules les cartes de la liste figée existent
  const members = memberCards, companies = companyCards;
  memberCards = (activeOnly = false) => {
    const r = cardRoster();
    return r?.members ? members(activeOnly).filter((c) => r.members.includes(c.memberId)) : members(activeOnly);
  };
  companyCards = () => {
    const r = cardRoster();
    return r?.companies ? companies().filter((c) => r.companies.includes(c.id.slice(3))) : companies();
  };
  // chaque mise à jour d'un membre passe par ici : les nouveaux sont mis en attente
  const cache = cacheMember;
  cacheMember = async (member) => {
    await cache(member);
    rosterNoteMember(member.id, member.displayName);
  };
}
function pendingPayload() {
  const p = cardPending(), entries = [...Object.entries(p.members).map(([id, x]) => ["mb", id, x]), ...Object.entries(p.companies).map(([id, x]) => ["co", id, x])];
  const lines = entries.map(([k, , x]) => `${k === "mb" ? "👤" : "🏢"} **${x.name}** — en attente depuis <t:${Math.floor(x.at / 1000)}:d>`);
  return {
    ephemeral: true,
    embeds: [
      new EmbedBuilder()
        .setColor(0x64748b)
        .setTitle("🃏 Cartes en attente")
        .setDescription(
          (lines.length ? lines.join("\n").slice(0, 3500) : "*Aucune carte en attente.*") +
            "\n\nCes membres et entreprises **n'ont pas de carte** : ils sont gardés pour la prochaine génération. Rien n'est ajouté sans votre accord : choisissez ci-dessous ceux à ajouter **maintenant** à la génération en cours."
        ),
    ],
    components: entries.length
      ? [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("carte_roster_add")
              .setPlaceholder("Ajouter maintenant aux cartes…")
              .setMinValues(1)
              .setMaxValues(Math.min(25, entries.length))
              .addOptions(entries.slice(0, 25).map(([k, id, x]) => ({ label: x.name.slice(0, 100), value: `${k}:${id}`, emoji: k === "mb" ? "👤" : "🏢", description: k === "mb" ? "Membre" : "Entreprise" })))
          ),
        ]
      : [],
  };
}
async function handleRosterInteraction(interaction) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === "generation" && interaction.options.getString("action") === "attente";
  if (!isCmd && interaction.customId !== "carte_roster_add") return false;
  if (!isGerant(interaction.member)) {
    await interaction.reply({ content: "⛔ Réservé aux gérants.", ephemeral: true });
    return true;
  }
  if (isCmd) {
    await interaction.reply(pendingPayload());
    return true;
  }
  const r = cardRoster(), p = cardPending(), added = [];
  for (const v of interaction.values) {
    const [k, id] = v.split(":");
    if (k === "mb" && p.members[id]) {
      if (!r.members.includes(id)) r.members.push(id);
      added.push(p.members[id].name);
      delete p.members[id];
    }
    if (k === "co" && p.companies[id]) {
      if (!r.companies.includes(id)) r.companies.push(id);
      added.push(p.companies[id].name);
      delete p.companies[id];
    }
  }
  save();
  panelDirty = true;
  const next = pendingPayload();
  await interaction.update({ ...next, content: `✅ Ajouté aux cartes : ${added.map((x) => `**${x}**`).join(", ")}.` });
  return true;
}
