const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const {
  changeBalance,
  addToTreasury,
  isFrozen,
  formatEuro,
  isGerant,
  refreshRichestLeaderboard,
} = require("./economie");
// Part de la Maison sur chaque séjour, réglée par le maire (80 % par défaut)
const { P, curfew } = require("./politique");
const { deleteLater, deleteInteractionMessageLater, getDossiersChannel, MINUTE, HOUR } = require("./nettoyage");
const hostShare = () => Math.round((1 - P().airbnbMaisonShare) * 100) / 100;

const AIRBNB_CHANNEL_ID = "1527544352090357881";
const RESPONSABLE_ROLE_ID = "1527543284765954050";
const HOTE_ROLE_ID = "1554949371194253425";

const PANEL_TITLE = "🏡 Airbnb de la Maison";
const MAX_LISTINGS_PER_HOST = 5;
const MIN_GAP_MS = 3 * 60 * 60 * 1000; // au moins 3 h entre deux demandes
const EXTRA_GAP_MS = 3 * 60 * 60 * 1000; // + jusqu'à 3 h de hasard
const REQUEST_TIMEOUT_MS = 2 * 60 * 60 * 1000;
// Acceptation automatique : l'hôte n'a pas besoin d'être là, mais touche 70 % de sa part
const AUTO_MS = 24 * 60 * 60 * 1000;
const AUTO_SHARE = 0.7;
const feed = () => require("./feed"); // sans réponse, le voyageur réserve ailleurs
const OPEN_HOUR = 7;
const CLOSE_HOUR = 21;
const CHECKOUT_HOUR = 11;

const { DATA_DIR, dataFile } = require("./data");
const STATE_FILE = dataFile("airbnb-state.json");

// Une seule copie en mémoire : la boucle automatique et les boutons
// modifient le même objet, sans s'écraser mutuellement.
let cache = null;

function loadState() {
  if (cache) return cache;
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    data.listings ??= {};
    data.hosts ??= {};
    data.requests ??= {};
    data.counter ??= 0;
    cache = data;
  } catch {
    cache = { listings: {}, hosts: {}, requests: {}, counter: 0, panelMessageId: null };
  }
  return cache;
}

function saveState(state) {
  cache = state;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function nextId(state, prefix) {
  state.counter += 1;
  return `${prefix}${state.counter}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function isResponsable(member) {
  return member?.roles.cache.has(RESPONSABLE_ROLE_ID) || isGerant(member);
}

// --- Heure de Paris ---

const parisFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parisMinutes(ts) {
  const parts = Object.fromEntries(parisFormat.formatToParts(new Date(ts)).map((p) => [p.type, p.value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function inBookingHours(ts) {
  const m = parisMinutes(ts);
  return m >= OPEN_HOUR * 60 && m < CLOSE_HOUR * 60;
}

// Ramène un instant à une heure donnée (heure de Paris) le même jour.
function atParisTime(ts, minutes) {
  const t = Math.floor(ts / 60000) * 60000;
  return t + (minutes - parisMinutes(t)) * 60000;
}

// Prochaine demande : au moins 3 h plus tard, et entre 7 h et 21 h.
function scheduleNextRequest(from) {
  let t = from + MIN_GAP_MS + Math.floor(Math.random() * EXTRA_GAP_MS);
  if (!inBookingHours(t)) {
    let morning = atParisTime(t, OPEN_HOUR * 60);
    if (morning <= t) morning = atParisTime(t + 24 * 3600 * 1000, OPEN_HOUR * 60);
    t = morning + Math.floor(Math.random() * 3 * 3600 * 1000);
  }
  return t;
}

function checkoutTime(from, nights) {
  return atParisTime(from + nights * 24 * 3600 * 1000, CHECKOUT_HOUR * 60);
}

function ts(ms, style = "f") {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

// --- Voyageurs fictifs ---

const ORIGINS = [
  { place: "Lyon, France", flag: "🇫🇷", male: ["Yves", "Julien", "Mathieu", "Antoine"], female: ["Charline", "Camille", "Élodie", "Manon"], last: ["Moreau", "Girard", "Lefèvre", "Fontaine"] },
  { place: "Marseille, France", flag: "🇫🇷", male: ["Karim", "Nicolas", "Rayan"], female: ["Sabrina", "Laura", "Inès"], last: ["Benali", "Rossi", "Martin"] },
  { place: "Bruxelles, Belgique", flag: "🇧🇪", male: ["Thomas", "Maxime"], female: ["Louise", "Amélie"], last: ["Dubois", "Peeters", "Lambert"] },
  { place: "Genève, Suisse", flag: "🇨🇭", male: ["Lukas", "Olivier"], female: ["Chloé", "Léa"], last: ["Favre", "Meier", "Rochat"] },
  { place: "Montréal, Canada", flag: "🇨🇦", male: ["Gabriel", "Samuel"], female: ["Émilie", "Justine"], last: ["Tremblay", "Gagnon", "Côté"] },
  { place: "Casablanca, Maroc", flag: "🇲🇦", male: ["Youssef", "Mehdi", "Omar"], female: ["Salma", "Nadia", "Imane"], last: ["El Amrani", "Bennani", "Alaoui"] },
  { place: "Dakar, Sénégal", flag: "🇸🇳", male: ["Moussa", "Ibrahima"], female: ["Awa", "Fatou"], last: ["Diop", "Ndiaye", "Sow"] },
  { place: "Abidjan, Côte d'Ivoire", flag: "🇨🇮", male: ["Koffi", "Yao"], female: ["Aya", "Mariam"], last: ["Kouassi", "Traoré", "Koné"] },
  { place: "Madrid, Espagne", flag: "🇪🇸", male: ["Javier", "Diego", "Pablo"], female: ["Lucía", "Carmen", "Sofía"], last: ["García", "Fernández", "López"] },
  { place: "Rome, Italie", flag: "🇮🇹", male: ["Marco", "Luca"], female: ["Giulia", "Francesca"], last: ["Bianchi", "Romano", "Ricci"] },
  { place: "Berlin, Allemagne", flag: "🇩🇪", male: ["Jonas", "Felix"], female: ["Hannah", "Lena"], last: ["Schmidt", "Weber", "Fischer"] },
  { place: "Londres, Royaume-Uni", flag: "🇬🇧", male: ["James", "Oliver"], female: ["Emily", "Charlotte"], last: ["Smith", "Taylor", "Brown"] },
  { place: "New York, États-Unis", flag: "🇺🇸", male: ["Michael", "Tyler", "Jordan"], female: ["Ashley", "Jessica", "Brianna"], last: ["Johnson", "Williams", "Shakur"] },
  { place: "Miami, États-Unis", flag: "🇺🇸", male: ["Carlos", "Andre"], female: ["Destiny", "Maria"], last: ["Rodriguez", "Jackson", "Rivera"] },
  { place: "São Paulo, Brésil", flag: "🇧🇷", male: ["Rafael", "Thiago"], female: ["Beatriz", "Larissa"], last: ["Silva", "Oliveira", "Souza"] },
  { place: "Tokyo, Japon", flag: "🇯🇵", male: ["Haruto", "Kenji"], female: ["Yui", "Sakura"], last: ["Tanaka", "Suzuki", "Watanabe"] },
  { place: "Séoul, Corée du Sud", flag: "🇰🇷", male: ["Min-jun", "Ji-ho"], female: ["Seo-yeon", "Ha-eun"], last: ["Kim", "Park", "Lee"] },
  { place: "Mumbai, Inde", flag: "🇮🇳", male: ["Arjun", "Rohan"], female: ["Priya", "Ananya"], last: ["Sharma", "Patel", "Mehta"] },
  { place: "Dubaï, Émirats arabes unis", flag: "🇦🇪", male: ["Khalid", "Rashid"], female: ["Layla", "Mariam"], last: ["Al Mansouri", "Al Nuaimi"] },
  { place: "Sydney, Australie", flag: "🇦🇺", male: ["Jack", "Liam"], female: ["Olivia", "Chloe"], last: ["Wilson", "Clarke", "Harris"] },
];

const JOBS = [
  "infirmière", "développeur", "avocate", "chef cuisinier", "photographe", "architecte",
  "professeure", "consultant", "pilote de ligne", "journaliste", "kinésithérapeute", "comptable",
];

// Chaque profil : combien de voyageurs, combien de nuits, et comment le présenter.
const PROFILES = [
  {
    guests: 2,
    nights: [2, 5],
    build(o) {
      const woman = pick(o.female);
      const last = pick(o.last);
      const man = pick(o.male);
      const age = randBetween(26, 45);
      return {
        name: `${woman} ${last}`,
        who: `**${woman} ${last}** et son mari **${man}**, ${age} ans`,
        reason: pick([
          "pour fêter leur anniversaire de mariage",
          "pour une escapade en amoureux",
          "pour leur lune de miel",
          "pour assister au mariage d'une amie",
          "pour souffler un peu loin du travail",
        ]),
        message: pick([
          "Bonjour ! Votre logement a l'air parfait pour nous. Nous sommes calmes et soigneux 😊",
          "Bonsoir, nous cherchons un endroit cosy pour quelques jours. Est-ce toujours disponible ?",
          "Hello ! Nous avons adoré les photos, ce serait un vrai plaisir de séjourner chez vous.",
        ]),
      };
    },
  },
  {
    guests: 2,
    nights: [3, 7],
    build(o) {
      const a = pick(o.female);
      const b = pick(o.male);
      const last = pick(o.last);
      const age = randBetween(62, 75);
      return {
        name: `${b} ${last}`,
        who: `**${b}** et **${a} ${last}**, retraités de ${age} ans`,
        reason: pick(["pour découvrir la région", "pour rendre visite à leurs petits-enfants", "pour un voyage prévu depuis des années"]),
        message: "Bonjour, nous voyageons tranquillement et cherchons un logement confortable et bien situé. Merci d'avance !",
      };
    },
  },
  {
    guests: [3, 5],
    nights: [3, 7],
    build(o, guests) {
      const last = pick(o.last);
      const kids = guests - 2;
      return {
        name: `Famille ${last}`,
        singular: true,
        who: `La **famille ${last}** (${pick(o.male)}, ${pick(o.female)} et ${kids > 1 ? `leurs ${kids} enfants` : "leur enfant"})`,
        reason: pick(["pour les vacances scolaires", "pour une réunion de famille", "pour un séjour au bord de la mer", "pour visiter les parcs d'attractions"]),
        message: "Bonjour ! Nous venons avec les enfants, ils sont sages promis 😄 Y a-t-il de quoi cuisiner sur place ?",
      };
    },
  },
  {
    guests: 1,
    nights: [1, 4],
    build(o) {
      const female = Math.random() < 0.5;
      const first = pick(female ? o.female : o.male);
      const last = pick(o.last);
      const age = randBetween(24, 55);
      return {
        name: `${first} ${last}`,
        who: `**${first} ${last}**, ${age} ans, ${pick(JOBS)}`,
        reason: pick(["pour un déplacement professionnel", "pour un séminaire", "pour un salon professionnel", "pour un entretien d'embauche"]),
        message: "Bonjour, je serai en déplacement pour le travail. J'ai besoin du Wi-Fi et d'un endroit calme. Merci !",
      };
    },
  },
  {
    guests: 1,
    nights: [2, 6],
    build(o) {
      const female = Math.random() < 0.5;
      const first = pick(female ? o.female : o.male);
      const last = pick(o.last);
      const age = randBetween(20, 35);
      return {
        name: `${first} ${last}`,
        who: `**${first} ${last}**, ${age} ans, voyageu${female ? "se" : "r"} en solo`,
        reason: pick(["pour un tour du monde sac au dos", "pour un concert", "pour se ressourcer", "pour télétravailler au calme"]),
        message: "Salut ! Je voyage seul(e) et votre bien m'a tapé dans l'œil. Je serai discret(e) 🙂",
      };
    },
  },
  {
    guests: [3, 6],
    nights: [2, 4],
    build(o, guests) {
      const first = pick([...o.male, ...o.female]);
      const last = pick(o.last);
      return {
        name: `${first} ${last}`,
        who: `**${first} ${last}** et ${guests - 1} ami(e)s`,
        reason: pick(["pour un enterrement de vie de jeune fille", "pour un festival de musique", "pour fêter un anniversaire", "pour un week-end entre amis"]),
        message: "Coucou ! On est une petite bande tranquille, pas de fête dans le logement, juré 🙏",
      };
    },
  },
];

// Personnage fictif réutilisable par les autres modules (entreprises…).
function randomPerson() {
  const origin = pick(ORIGINS);
  const female = Math.random() < 0.5;
  return {
    first: pick(female ? origin.female : origin.male),
    last: pick(origin.last),
    female,
    age: randBetween(19, 70),
    place: origin.place,
    flag: origin.flag,
  };
}

function generateGuest(capacity) {
  const fitting = PROFILES.filter((p) => (Array.isArray(p.guests) ? p.guests[0] : p.guests) <= capacity);
  const profile = pick(fitting.length ? fitting : PROFILES.filter((p) => p.guests === 1));
  const guests = Array.isArray(profile.guests)
    ? randBetween(profile.guests[0], Math.min(profile.guests[1], capacity))
    : profile.guests;
  const origin = pick(ORIGINS);
  const nights = randBetween(profile.nights[0], profile.nights[1]);
  return { ...profile.build(origin, guests), guests, nights, place: origin.place, flag: origin.flag };
}

const REVIEWS = {
  5: ["Séjour parfait, hôte adorable, on reviendra !", "Logement impeccable et très bien situé. Merci pour tout !", "Tout était comme sur les photos, voire mieux ✨"],
  4: ["Très bon séjour, logement propre et agréable.", "Super emplacement, petit bémol sur le bruit le soir.", "Bon accueil, on recommande."],
  3: ["Correct, mais quelques détails à améliorer.", "Séjour moyen, le logement mériterait un rafraîchissement."],
};

function generateReview() {
  const r = Math.random();
  const stars = r < 0.55 ? 5 : r < 0.88 ? 4 : 3;
  return { stars, text: pick(REVIEWS[stars]) };
}

// --- Affichage ---

function ratingText(listing) {
  if (!listing.reviews) return "nouveau";
  return `⭐ ${(listing.ratingSum / listing.reviews).toFixed(1).replace(".", ",")} (${listing.reviews})`;
}

function listingLine(l) {
  const status =
    l.status === "suspended"
      ? "⛔ suspendu"
      : l.occupiedUntil
        ? `🔴 occupé jusqu'au ${ts(l.occupiedUntil, "d")}`
        : "🟢 libre";
  return `🏠 **${l.name}** — ${l.location} · ${formatEuro(l.price)}/nuit · ${l.capacity} pers. · ${ratingText(l)} · <@${l.hostId}> · ${status}`;
}

function buildPanelMessage() {
  const state = loadState();
  const listings = Object.values(state.listings).filter((l) => l.status === "active" || l.status === "suspended");
  const online = Object.entries(state.hosts).filter(([, h]) => h.on).length;

  let body = "";
  for (const l of listings) {
    const line = listingLine(l) + "\n";
    if (body.length + line.length > 3000) {
      body += `*… et ${listings.length - body.split("\n").length + 1} autres biens*`;
      break;
    }
    body += line;
  }

  const embed = new EmbedBuilder()
    .setColor(0xff5a5f)
    .setTitle(PANEL_TITLE)
    .setDescription(
      "Mettez vos biens en location et accueillez des voyageurs du monde entier.\n\n" +
        "🏠 **Proposer un bien** — soumis à la validation d'un responsable\n" +
        "🟢 **Activer / Désactiver** — quand c'est activé, des voyageurs vous envoient des demandes (entre 7h et 21h)\n" +
        "🤖 **Acceptation auto** — le bot accepte les réservations pour vous pendant 24 h (vous touchez 70 % de votre part)\n" +
        "📂 **Mes biens** — gérer vos logements\n" +
        "🛠️ **Gestion** — réservé aux responsables Airbnb\n\n" +
        `💶 Chaque séjour : **${Math.round(hostShare() * 100)} %** pour l'hôte, **${Math.round((1 - hostShare()) * 100)} %** pour la Maison. Ménage compris.\n\n` +
        `**Biens disponibles (${listings.length})**\n${body || "*Aucun bien pour le moment.*"}`
    )
    .setFooter({ text: `${online} hôte(s) en ligne` })
    .setTimestamp();

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("airbnb_add").setLabel("Proposer un bien").setEmoji("🏠").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("airbnb_toggle").setLabel("Activer / Désactiver").setEmoji("🟢").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("airbnb_auto").setLabel("Acceptation auto").setEmoji("🤖").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("airbnb_mine").setLabel("Mes biens").setEmoji("📂").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("airbnb_admin").setLabel("Gestion").setEmoji("🛠️").setStyle(ButtonStyle.Danger)
      ),
    ],
  };
}

let panelDirty = false;

async function refreshPanel(client) {
  const channel = await client.channels.fetch(AIRBNB_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) {
    console.warn(`Salon Airbnb ${AIRBNB_CHANNEL_ID} introuvable`);
    return;
  }
  const state = loadState();
  let message = state.panelMessageId
    ? await channel.messages.fetch(state.panelMessageId).catch(() => null)
    : null;
  if (!message) {
    const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
    message = recent?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === PANEL_TITLE);
  }
  if (message) await message.edit(buildPanelMessage());
  else message = await channel.send(buildPanelMessage());

  if (state.panelMessageId !== message.id) {
    const fresh = loadState();
    fresh.panelMessageId = message.id;
    saveState(fresh);
  }
}

async function sendToChannel(client, payload) {
  const channel = await client.channels.fetch(AIRBNB_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return null;
  return channel.send(payload).catch(() => null);
}

async function editRequestMessage(client, request, payload, deleteAfter = 0) {
  const channel = await client.channels.fetch(AIRBNB_CHANNEL_ID).catch(() => null);
  const msg = await channel?.messages.fetch(request.messageId).catch(() => null);
  if (msg) await msg.edit(payload).catch(() => null);
  if (msg && deleteAfter) deleteLater(msg, deleteAfter);
}

// --- Boucle : demandes, départs, expirations ---

function freeListings(state, hostId) {
  return Object.values(state.listings).filter(
    (l) => l.hostId === hostId && l.status === "active" && !l.occupiedUntil
  );
}

function requestEmbed(request, listing, footer) {
  const g = request.guest;
  const total = listing ? request.total : request.total;
  return new EmbedBuilder()
    .setColor(0xff5a5f)
    .setTitle("📩 Nouvelle demande de réservation")
    .setDescription(
      `${g.who}, venant de **${g.place}** ${g.flag}, ${g.reason}, ${g.guests > 1 && !g.singular ? "veulent" : "veut"} réserver **${request.listingName}**.\n\n` +
        `> *« ${g.message} »*`
    )
    .addFields(
      { name: "Voyageurs", value: String(g.guests), inline: true },
      { name: "Nuits", value: String(g.nights), inline: true },
      { name: "Total du séjour", value: formatEuro(total), inline: true },
      { name: `Votre part (${Math.round(hostShare() * 100)} %)`, value: `**${formatEuro(round2(total * hostShare()))}**`, inline: true },
      { name: "Arrivée", value: "Dès acceptation", inline: true },
      { name: "Départ prévu", value: ts(checkoutTime(Date.now(), g.nights), "f"), inline: true }
    )
    .setFooter({ text: footer ?? `Sans réponse, le voyageur réservera ailleurs` })
    .setTimestamp(request.createdAt);
}

async function createRequest(client, state, hostId) {
  const listing = pick(freeListings(state, hostId));
  const guest = generateGuest(listing.capacity);
  const id = nextId(state, "r");
  const request = {
    id,
    hostId,
    listingId: listing.id,
    listingName: listing.name,
    guest,
    total: round2(listing.price * guest.nights),
    createdAt: Date.now(),
    autoWait: randBetween(1, 5) * MINUTE,
  };

  const message = await sendToChannel(client, {
    content: `<@${hostId}>`,
    allowedMentions: { users: [hostId] },
    embeds: [requestEmbed(request, listing, `Réponse attendue avant ${new Date(Date.now() + REQUEST_TIMEOUT_MS).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}`)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`airbnb_req_ok_${id}`).setLabel("Accepter").setEmoji("✅").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`airbnb_req_no_${id}`).setLabel("Refuser").setEmoji("❌").setStyle(ButtonStyle.Danger)
      ),
    ],
  });
  if (!message) return;
  request.messageId = message.id;
  state.requests[id] = request;
}

async function tick(client) {
  const state = loadState();
  const now = Date.now();
  let changed = false;

  // Acceptation automatique pour les hôtes qui l'ont activée
  for (const request of Object.values(state.requests)) {
    const host = state.hosts[request.hostId];
    if (!host?.autoUntil || host.autoUntil < now || now - request.createdAt < (request.autoWait ?? 2 * MINUTE)) continue;
    const listing = state.listings[request.listingId];
    if (!listing || listing.occupiedUntil || listing.status !== "active" || isFrozen(request.hostId)) continue;
    delete state.requests[request.id];
    const embed = confirmBooking(state, request, listing, true);
    await editRequestMessage(client, request, { content: `<@${request.hostId}>`, embeds: [embed], components: [] }, 2 * MINUTE);
    changed = true;
  }

  // Demandes restées sans réponse
  for (const request of Object.values(state.requests)) {
    if (now - request.createdAt < REQUEST_TIMEOUT_MS) continue;
    delete state.requests[request.id];
    changed = true;
    await editRequestMessage(client, request, {
      embeds: [
        requestEmbed(request, null, "Sans réponse — le voyageur a réservé ailleurs").setColor(0x95a5a6).setTitle("⌛ Demande expirée"),
      ],
      components: [],
    }, MINUTE);
  }

  // Départs des voyageurs et avis
  for (const listing of Object.values(state.listings)) {
    if (!listing.occupiedUntil || listing.occupiedUntil > now) continue;
    const review = generateReview();
    const guestName = listing.currentGuest ?? "Un voyageur";
    listing.occupiedUntil = null;
    listing.currentGuest = null;
    listing.reviews = (listing.reviews ?? 0) + 1;
    listing.ratingSum = (listing.ratingSum ?? 0) + review.stars;
    changed = true;
    panelDirty = true;
    feed().post(`🧳 ${guestName} quitte **${listing.name}** et laisse ${"⭐".repeat(review.stars)}`);
    const departure = await sendToChannel(client, {
      content: `<@${listing.hostId}>`,
      allowedMentions: { users: [listing.hostId] },
      embeds: [
        new EmbedBuilder()
          .setColor(0xffc107)
          .setTitle(`🧳 Départ — ${listing.name}`)
          .setDescription(
            `**${guestName}** a quitté le logement. Le ménage est fait, le bien est de nouveau **libre**.\n\n` +
              `${"⭐".repeat(review.stars)}${"☆".repeat(5 - review.stars)}\n> *« ${review.text} »*`
          )
          .setTimestamp(),
      ],
    });
    deleteLater(departure, 30 * MINUTE);
  }

  // Nouvelles demandes pour les hôtes en ligne
  // Pendant un couvre-feu (dictature), aucun voyageur n'arrive.
  if (inBookingHours(now) && !curfew()) {
    for (const [hostId, host] of Object.entries(state.hosts)) {
      if (!host.on || now < host.nextAt) continue;
      if (Object.values(state.requests).some((r) => r.hostId === hostId)) continue;
      if (isFrozen(hostId) || !freeListings(state, hostId).length) continue;
      await createRequest(client, state, hostId);
      host.nextAt = scheduleNextRequest(now);
      changed = true;
    }
  }

  if (changed) saveState(state);
  if (panelDirty) {
    panelDirty = false;
    await refreshPanel(client);
  }
}

// Au démarrage : supprime les anciens messages déjà traités qui encombrent le salon.
const CLEAN_TITLES = ["✅ Bien validé", "❌ Bien refusé", "✏️ Bien modifié", "⌛ Demande expirée", "❌ Demande refusée", "✅ Réservation confirmée"];
async function cleanOldMessages(client) {
  const channel = await client.channels.fetch(AIRBNB_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return;
  const now = Date.now();
  let count = 0;
  for (const m of messages.values()) {
    if (m.author.id !== client.user.id || m.components.length) continue; // jamais un message encore actif
    const title = m.embeds[0]?.title ?? "";
    const done = CLEAN_TITLES.some((t) => title.startsWith(t)) && now - m.createdTimestamp > MINUTE;
    const oldDeparture = title.startsWith("🧳 Départ") && now - m.createdTimestamp > 30 * MINUTE;
    if (done || oldDeparture) {
      await m.delete().catch(() => null);
      count++;
    }
  }
  if (count) console.log(`Airbnb : ${count} ancien(s) message(s) nettoyé(s)`);
}

async function setupAirbnb(client) {
  await refreshPanel(client);
  await cleanOldMessages(client);
  setInterval(() => {
    tick(client).catch((err) => console.error("Airbnb:", err.message));
  }, 60 * 1000);
  console.log("Airbnb prêt");
}

// --- Actions des hôtes ---

function listingModal(customId, title, listing) {
  const input = (id, label, style, value, opts = {}) => {
    const t = new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(style)
      .setRequired(opts.required ?? true)
      .setMaxLength(opts.max ?? 100);
    if (opts.placeholder) t.setPlaceholder(opts.placeholder);
    if (value !== undefined) t.setValue(String(value));
    return new ActionRowBuilder().addComponents(t);
  };
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      input("nom", "Nom du bien", TextInputStyle.Short, listing?.name, { placeholder: "ex. Villa Azur, Loft Bastille…", max: 60 }),
      input("lieu", "Ville / pays", TextInputStyle.Short, listing?.location, { placeholder: "ex. Nice, France", max: 60 }),
      input("prix", "Prix par nuit (€)", TextInputStyle.Short, listing?.price, { placeholder: "ex. 150", max: 8 }),
      input("capacite", "Capacité (nombre de voyageurs)", TextInputStyle.Short, listing?.capacity, { placeholder: "1 à 10", max: 2 }),
      input("description", "Description", TextInputStyle.Paragraph, listing?.description, { max: 500, required: false })
    );
}

function readListingFields(interaction) {
  const f = (k) => interaction.fields.getTextInputValue(k).trim();
  const price = parseInt(f("prix").replace(/[^\d]/g, ""), 10) || 0;
  const capacity = parseInt(f("capacite").replace(/[^\d]/g, ""), 10) || 0;
  if (price < 10 || price > 100000) return { error: "❌ Le prix par nuit doit être entre 10 € et 100 000 €." };
  if (capacity < 1 || capacity > 10) return { error: "❌ La capacité doit être entre 1 et 10 voyageurs." };
  return { name: f("nom"), location: f("lieu"), price, capacity, description: f("description") };
}

async function submitListing(interaction, client) {
  const fields = readListingFields(interaction);
  if (fields.error) {
    await interaction.reply({ content: fields.error, ephemeral: true });
    return;
  }
  const state = loadState();
  const owned = Object.values(state.listings).filter((l) => l.hostId === interaction.user.id);
  if (owned.length >= MAX_LISTINGS_PER_HOST) {
    await interaction.reply({ content: `❌ Maximum ${MAX_LISTINGS_PER_HOST} biens par hôte.`, ephemeral: true });
    return;
  }

  const id = nextId(state, "b");
  const listing = { id, hostId: interaction.user.id, status: "pending", createdAt: Date.now(), ...fields };
  state.listings[id] = listing;
  saveState(state);

  await postValidationRequest(client, listing, interaction.user, false);
  await interaction.reply({ content: "📨 Votre bien a été envoyé aux responsables Airbnb pour validation.", ephemeral: true });
}

async function postValidationRequest(client, listing, user, edited) {
  await sendToChannel(client, {
    content: `<@&${RESPONSABLE_ROLE_ID}>`,
    allowedMentions: { roles: [RESPONSABLE_ROLE_ID] },
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(edited ? "✏️ Bien modifié à revalider" : "🏠 Nouveau bien à valider")
        .setDescription(`Proposé par ${user}\n\n**${listing.name}** — ${listing.location}\n${listing.description || "*Pas de description.*"}`)
        .addFields(
          { name: "Prix / nuit", value: formatEuro(listing.price), inline: true },
          { name: "Capacité", value: `${listing.capacity} pers.`, inline: true }
        )
        .setFooter({ text: "Validation réservée aux responsables Airbnb" })
        .setTimestamp(),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`airbnb_validate_ok_${listing.id}`).setLabel("Valider").setEmoji("✅").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`airbnb_validate_no_${listing.id}`).setLabel("Refuser").setEmoji("❌").setStyle(ButtonStyle.Danger)
      ),
    ],
  });
}

async function validateListing(interaction, accepted, id) {
  if (!isResponsable(interaction.member)) {
    await interaction.reply({ content: "❌ Réservé aux responsables Airbnb.", ephemeral: true });
    return;
  }
  const state = loadState();
  const listing = state.listings[id];
  if (!listing || listing.status !== "pending") {
    await interaction.update({ components: [] });
    return;
  }

  if (accepted) {
    listing.status = "active";
    listing.approved = true;
    const member = await interaction.guild.members.fetch(listing.hostId).catch(() => null);
    await member?.roles.add(HOTE_ROLE_ID).catch(() => null);
  } else if (listing.approved) {
    listing.status = "suspended"; // bien existant : on le met en pause au lieu de le supprimer
  } else {
    delete state.listings[id];
  }
  saveState(state);
  panelDirty = true;

  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(accepted ? 0x2ecc71 : 0xe74c3c)
    .setTitle(accepted ? "✅ Bien validé" : "❌ Bien refusé")
    .setFooter({ text: `${accepted ? "Validé" : "Refusé"} par ${interaction.user.tag}` });
  await interaction.update({ content: `<@${listing.hostId}>`, embeds: [embed], components: [] });
  deleteInteractionMessageLater(interaction, MINUTE);
}

async function toggleAuto(interaction) {
  const state = loadState();
  const host = (state.hosts[interaction.user.id] ??= { on: false, nextAt: 0 });
  if (!host.on) {
    await interaction.reply({ content: "🔴 Activez d'abord votre Airbnb avec le bouton « Activer / Désactiver ».", ephemeral: true });
    return;
  }
  const active = host.autoUntil && host.autoUntil > Date.now();
  host.autoUntil = active ? 0 : Date.now() + AUTO_MS;
  saveState(state);
  await interaction.reply({
    content: active
      ? "✋ **Acceptation automatique désactivée.** Vous acceptez à nouveau les demandes vous-même."
      : `🤖 **Acceptation automatique activée pour 24 h.** Les réservations sont acceptées pour vous en 1 à 5 minutes ; vous touchez **${Math.round(AUTO_SHARE * 100)} %** de votre part habituelle. Revenez la relancer ensuite !`,
    ephemeral: true,
  });
}

async function toggleHost(interaction) {
  const state = loadState();
  const userId = interaction.user.id;
  const active = Object.values(state.listings).filter((l) => l.hostId === userId && l.status === "active");
  const host = (state.hosts[userId] ??= { on: false, nextAt: 0 });

  if (!host.on && !active.length) {
    await interaction.reply({ content: "❌ Vous n'avez aucun bien validé. Proposez d'abord un bien.", ephemeral: true });
    return;
  }
  if (!host.on && isFrozen(userId)) {
    await interaction.reply({ content: "🔒 Votre compte est gelé par l'IRF.", ephemeral: true });
    return;
  }

  host.on = !host.on;
  if (host.on) host.nextAt = scheduleNextRequest(Date.now());
  saveState(state);
  panelDirty = true;

  await interaction.reply({
    content: host.on
      ? `🟢 **Airbnb activé !** Vos ${active.length} bien(s) sont visibles par les voyageurs. Première demande possible à partir de ${ts(host.nextAt, "t")} (les demandes arrivent entre ${OPEN_HOUR}h et ${CLOSE_HOUR}h).`
      : "🔴 **Airbnb désactivé.** Vous ne recevrez plus de demandes. Les séjours en cours continuent.",
    ephemeral: true,
  });
}

function listingSelect(customId, listings, placeholder) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(
        listings.slice(0, 25).map((l) => ({
          label: l.name.slice(0, 100),
          value: l.id,
          description: `${l.location} · ${l.price} €/nuit · ${l.status === "pending" ? "en attente" : l.status === "suspended" ? "suspendu" : l.occupiedUntil ? "occupé" : "libre"}`.slice(0, 100),
        }))
      )
  );
}

async function showMine(interaction) {
  const state = loadState();
  const mine = Object.values(state.listings).filter((l) => l.hostId === interaction.user.id);
  const host = state.hosts[interaction.user.id];
  const earned = mine.reduce((s, l) => s + (l.earned ?? 0), 0);

  const embed = new EmbedBuilder()
    .setColor(0xff5a5f)
    .setTitle("📂 Mes biens")
    .setDescription(
      `Statut : ${host?.on ? "🟢 **activé**" : "🔴 **désactivé**"}\nGains totaux : **${formatEuro(round2(earned))}**\n\n` +
        (mine.length
          ? mine.map((l) => (l.status === "pending" ? `⏳ **${l.name}** — en attente de validation` : listingLine(l))).join("\n")
          : "*Vous n'avez aucun bien.*")
    );

  await interaction.reply({
    embeds: [embed],
    components: mine.length ? [listingSelect("airbnb_mine_select", mine, "Choisir un bien à modifier ou retirer")] : [],
    ephemeral: true,
  });
}

function manageButtons(listing, admin) {
  const row = new ActionRowBuilder();
  if (admin) {
    row.addComponents(
      listing.status === "suspended"
        ? new ButtonBuilder().setCustomId(`airbnb_unsuspend_${listing.id}`).setLabel("Réactiver").setEmoji("✅").setStyle(ButtonStyle.Success)
        : new ButtonBuilder().setCustomId(`airbnb_suspend_${listing.id}`).setLabel("Suspendre").setEmoji("⛔").setStyle(ButtonStyle.Secondary)
    );
  } else {
    row.addComponents(
      new ButtonBuilder().setCustomId(`airbnb_edit_${listing.id}`).setLabel("Modifier").setEmoji("✏️").setStyle(ButtonStyle.Primary)
    );
  }
  row.addComponents(
    new ButtonBuilder().setCustomId(`airbnb_remove_${listing.id}`).setLabel("Retirer").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
  );
  return [row];
}

async function showListingActions(interaction, admin) {
  const listing = loadState().listings[interaction.values[0]];
  if (!listing) {
    await interaction.reply({ content: "❌ Bien introuvable.", ephemeral: true });
    return;
  }
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xff5a5f)
        .setTitle(listing.name)
        .setDescription(`${listingLine(listing)}\n\n${listing.description || "*Pas de description.*"}\n\nSéjours : ${listing.reviews ?? 0} · Gains hôte : ${formatEuro(listing.earned ?? 0)}`),
    ],
    components: manageButtons(listing, admin),
    ephemeral: true,
  });
}

async function showAdmin(interaction) {
  if (!isResponsable(interaction.member)) {
    await interaction.reply({ content: "❌ Réservé aux responsables Airbnb.", ephemeral: true });
    return;
  }
  const state = loadState();
  const listings = Object.values(state.listings);
  const online = Object.entries(state.hosts).filter(([, h]) => h.on);
  const pending = listings.filter((l) => l.status === "pending").length;
  const revenue = listings.reduce((s, l) => s + (l.revenue ?? 0), 0);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🛠️ Gestion Airbnb")
    .addFields(
      { name: "Biens", value: String(listings.length), inline: true },
      { name: "En attente", value: String(pending), inline: true },
      { name: "Demandes en cours", value: String(Object.keys(state.requests).length), inline: true },
      { name: "Chiffre d'affaires total", value: formatEuro(round2(revenue)), inline: true },
      { name: `Part de la Maison (${Math.round((1 - hostShare()) * 100)} %)`, value: formatEuro(round2(revenue * (1 - hostShare()))), inline: true },
      { name: "Hôtes en ligne", value: online.length ? online.map(([id]) => `<@${id}>`).join(", ").slice(0, 1024) : "Aucun" }
    );

  await interaction.reply({
    embeds: [embed],
    components: listings.length ? [listingSelect("airbnb_admin_select", listings, "Choisir un bien à suspendre ou retirer")] : [],
    ephemeral: true,
  });
}

async function updateListing(interaction, id, client) {
  const state = loadState();
  const listing = state.listings[id];
  if (!listing || listing.hostId !== interaction.user.id) {
    await interaction.reply({ content: "❌ Bien introuvable.", ephemeral: true });
    return;
  }
  const fields = readListingFields(interaction);
  if (fields.error) {
    await interaction.reply({ content: fields.error, ephemeral: true });
    return;
  }
  if (listing.occupiedUntil) {
    await interaction.reply({ content: "❌ Des voyageurs sont sur place : modifiez le bien après leur départ.", ephemeral: true });
    return;
  }
  // Toute modification repasse par un responsable (évite de gonfler le prix après validation).
  Object.assign(listing, fields, { status: "pending" });
  for (const r of Object.values(state.requests)) if (r.listingId === id) delete state.requests[r.id];
  saveState(state);
  panelDirty = true;
  await postValidationRequest(client, listing, interaction.user, true);
  await interaction.reply({
    content: `✏️ **${listing.name}** a été modifié et renvoyé aux responsables pour validation. Il ne reçoit plus de demandes d'ici là.`,
    ephemeral: true,
  });
}

async function removeListing(interaction, id) {
  const state = loadState();
  const listing = state.listings[id];
  if (!listing) {
    await interaction.update({ content: "❌ Bien introuvable.", embeds: [], components: [] });
    return;
  }
  const admin = isResponsable(interaction.member);
  if (listing.hostId !== interaction.user.id && !admin) {
    await interaction.reply({ content: "❌ Ce bien ne vous appartient pas.", ephemeral: true });
    return;
  }
  if (listing.occupiedUntil) {
    await interaction.reply({ content: "❌ Des voyageurs sont sur place : attendez leur départ.", ephemeral: true });
    return;
  }
  delete state.listings[id];
  for (const r of Object.values(state.requests)) if (r.listingId === id) delete state.requests[r.id];
  saveState(state);
  panelDirty = true;
  await interaction.update({ content: `🗑️ **${listing.name}** a été retiré.`, embeds: [], components: [] });
}

async function setSuspended(interaction, id, suspended) {
  if (!isResponsable(interaction.member)) {
    await interaction.reply({ content: "❌ Réservé aux responsables Airbnb.", ephemeral: true });
    return;
  }
  const state = loadState();
  const listing = state.listings[id];
  if (!listing) {
    await interaction.update({ content: "❌ Bien introuvable.", embeds: [], components: [] });
    return;
  }
  listing.status = suspended ? "suspended" : "active";
  saveState(state);
  panelDirty = true;
  await interaction.update({
    content: suspended ? `⛔ **${listing.name}** est suspendu.` : `✅ **${listing.name}** est réactivé.`,
    embeds: [],
    components: [],
  });
}

// --- Réponse de l'hôte à une demande ---

function confirmBooking(state, request, listing, auto = false) {
  const g = request.guest;
  const fullHostPart = round2(request.total * hostShare());
  const hostPart = auto ? round2(fullHostPart * AUTO_SHARE) : fullHostPart;
  const maisonPart = round2(request.total - hostPart);
  const checkout = checkoutTime(Date.now(), g.nights);

  listing.occupiedUntil = checkout;
  listing.currentGuest = g.name;
  listing.revenue = round2((listing.revenue ?? 0) + request.total);
  listing.earned = round2((listing.earned ?? 0) + hostPart);
  saveState(state);
  panelDirty = true;

  changeBalance(request.hostId, hostPart, `Airbnb${auto ? " (auto)" : ""} — ${g.name} à ${listing.name} (${g.nights} nuit${g.nights > 1 ? "s" : ""})`);
  addToTreasury("airbnb", maisonPart);
  feed().post(`🏡 ${g.name} ${g.flag} s'installe à **${listing.name}** pour ${g.nights} nuit${g.nights > 1 ? "s" : ""}`, { stat: "sejours" });

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("✅ Réservation confirmée")
    .setDescription(
      `${g.who} ${g.flag} séjourne à **${listing.name}** pour **${g.nights} nuit${g.nights > 1 ? "s" : ""}**.\n` +
        `Départ prévu ${ts(checkout, "F")}.`
    )
    .addFields(
      { name: "Total du séjour", value: formatEuro(request.total), inline: true },
      { name: auto ? "Pour l'hôte (auto, 70 % de sa part)" : `Pour l'hôte (${Math.round(hostShare() * 100)} %)`, value: `**${formatEuro(hostPart)}**`, inline: true },
      { name: "Pour la Maison", value: formatEuro(maisonPart), inline: true }
    )
    .setFooter(auto ? { text: "🤖 Acceptée automatiquement" } : null)
    .setTimestamp();
}

async function answerRequest(interaction, accepted, id, client) {
  const state = loadState();
  const request = state.requests[id];
  if (!request) {
    await interaction.update({ components: [] });
    return;
  }
  if (interaction.user.id !== request.hostId) {
    await interaction.reply({ content: "❌ Cette demande ne vous est pas adressée.", ephemeral: true });
    return;
  }

  const listing = state.listings[request.listingId];
  delete state.requests[id];
  const g = request.guest;

  if (!accepted || !listing || listing.occupiedUntil || listing.status !== "active") {
    saveState(state);
    const embed = requestEmbed(request, listing, accepted ? "Le bien n'est plus disponible" : "Demande refusée par l'hôte")
      .setColor(0x95a5a6)
      .setTitle("❌ Demande refusée");
    await interaction.update({ embeds: [embed], components: [] });
    deleteInteractionMessageLater(interaction, 2 * MINUTE);
    return;
  }

  if (isFrozen(request.hostId)) {
    state.requests[id] = request;
    await interaction.reply({ content: "🔒 Votre compte est gelé par l'IRF : impossible d'accepter.", ephemeral: true });
    return;
  }

  const embed = confirmBooking(state, request, listing, false);
  await refreshRichestLeaderboard(client).catch(() => null);
  await interaction.update({ content: `<@${request.hostId}>`, embeds: [embed], components: [] });
  deleteInteractionMessageLater(interaction, 2 * MINUTE);
}

// --- Routage ---

async function handleAirbnbInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("airbnb_")) return false;

  if (interaction.isButton()) {
    if (id === "airbnb_add") await interaction.showModal(listingModal("airbnb_modal_add", "🏠 Proposer un bien"));
    else if (id === "airbnb_toggle") await toggleHost(interaction);
    else if (id === "airbnb_auto") await toggleAuto(interaction);
    else if (id === "airbnb_mine") await showMine(interaction);
    else if (id === "airbnb_admin") await showAdmin(interaction);
    else if (id.startsWith("airbnb_validate_")) {
      const [, , decision, listingId] = id.split("_");
      await validateListing(interaction, decision === "ok", listingId);
    } else if (id.startsWith("airbnb_req_")) {
      const [, , decision, requestId] = id.split("_");
      await answerRequest(interaction, decision === "ok", requestId, client);
    } else if (id.startsWith("airbnb_edit_")) {
      const listing = loadState().listings[id.slice("airbnb_edit_".length)];
      if (!listing || listing.hostId !== interaction.user.id) {
        await interaction.reply({ content: "❌ Bien introuvable.", ephemeral: true });
      } else {
        await interaction.showModal(listingModal(`airbnb_modal_edit_${listing.id}`, "✏️ Modifier le bien", listing));
      }
    } else if (id.startsWith("airbnb_remove_")) await removeListing(interaction, id.slice("airbnb_remove_".length));
    else if (id.startsWith("airbnb_suspend_")) await setSuspended(interaction, id.slice("airbnb_suspend_".length), true);
    else if (id.startsWith("airbnb_unsuspend_")) await setSuspended(interaction, id.slice("airbnb_unsuspend_".length), false);
    return true;
  }

  if (interaction.isStringSelectMenu()) {
    if (id === "airbnb_mine_select") await showListingActions(interaction, false);
    else if (id === "airbnb_admin_select") {
      if (!isResponsable(interaction.member)) {
        await interaction.reply({ content: "❌ Réservé aux responsables Airbnb.", ephemeral: true });
      } else {
        await showListingActions(interaction, true);
      }
    }
    return true;
  }

  if (interaction.isModalSubmit()) {
    if (id === "airbnb_modal_add") await submitListing(interaction, client);
    else if (id.startsWith("airbnb_modal_edit_")) await updateListing(interaction, id.slice("airbnb_modal_edit_".length), client);
    return true;
  }

  return false;
}

module.exports = { setupAirbnb, handleAirbnbInteraction, randomPerson };
