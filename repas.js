const cron = require("node-cron");
const { EmbedBuilder } = require("discord.js");

const REPAS_CHANNEL_ID = "1509983930294472817";
const MEMBRE_ROLE_ID = "1509983439968010401";
const MENU_TITLE = "🍽️ Menu du jour";

// Les tailles des listes sont des nombres premiers différents (31, 37, 43, 41) :
// chaque liste tourne à son propre rythme, donc les combinaisons changent sans cesse.
// Un plat ne revient qu'après avoir épuisé toute sa liste (au moins 18 jours).
const PETIT_DEJEUNER = [
  "Pancakes soufflés japonais, sirop d'érable et beurre noisette",
  "Œufs Bénédicte au saumon fumé, sauce hollandaise et muffin toasté",
  "Brioche perdue caramélisée, crème vanille et fruits rouges",
  "Croissant aux amandes, chocolat chaud à l'ancienne et chantilly",
  "Gaufres de Liège, chocolat fondu, banane caramélisée et noisettes",
  "Açaï bowl, granola maison au miel, mangue et noix de coco",
  "Œufs brouillés crémeux à la truffe et pain de campagne grillé",
  "Kouign-amann tiède, caramel beurre salé et pommes rôties",
  "Crêpes Suzette flambées à l'orange et beurre de sucre",
  "Shakshuka aux œufs, feta, herbes fraîches et pain pita chaud",
  "Bagel au saumon fumé, cream cheese à l'aneth et câpres",
  "Avocado toast sur pain au levain, œuf poché et piment d'Espelette",
  "English breakfast complet — bacon, saucisses, œufs, haricots et champignons",
  "Cinnamon rolls tièdes, glaçage au cream cheese et café latte",
  "Porridge crémeux, poire pochée, noix de pécan et sirop d'érable",
  "Viennoiseries du boulanger et jus d'orange pressé minute",
  "Croque-madame à la truffe, œuf au plat et salade de pousses",
  "Yaourt grec, miel de lavande, figues rôties et pistaches",
  "Muffins anglais, œufs cocotte à la crème et ciboulette",
  "Huevos rancheros, avocat, haricots noirs et tortillas chaudes",
  "Chaussons aux pommes, pains aux raisins et chocolat viennois",
  "Dutch baby au four, citron, sucre glace et myrtilles",
  "Tartine ricotta, miel de châtaignier, noix et poires fines",
  "Omelette soufflée au comté 24 mois et jambon à l'os",
  "Pancakes banane-chocolat, beurre de cacahuète et éclats de noisettes",
  "Bagel pastrami, cornichons, moutarde à l'ancienne et œuf mollet",
  "Brioche feuilletée à la praline rose et café crème",
  "Smoothie bowl passion-kiwi, graines de chia et granola croustillant",
  "Crumpets beurrés, lemon curd maison et thé Earl Grey",
  "Assiette nordique — gravlax, œufs mimosa, pain de seigle et beurre salé",
  "Churros dorés et chocolat chaud épais à l'espagnole",
];

const ENTREES = [
  "Burrata crémeuse, tomates anciennes, pesto de basilic et pignons",
  "Foie gras mi-cuit, chutney de figues et pain d'épices toasté",
  "Carpaccio de Saint-Jacques, agrumes et huile de vanille",
  "Velouté de châtaignes, crème montée et éclats de noisettes",
  "Tartare de saumon à l'avocat, citron vert et coriandre",
  "Œuf parfait basse température, crème de champignons et truffe",
  "Gyozas grillés au porc et sauce ponzu",
  "Soupe à l'oignon gratinée au comté",
  "Vitello tonnato, câpres et roquette",
  "Ceviche de daurade, lait de tigre et mangue",
  "Salade de chèvre chaud au miel, noix et lardons",
  "Croquetas de jamón ibérico et aïoli",
  "Gaspacho andalou et tuile au parmesan",
  "Escargots de Bourgogne au beurre persillé",
  "Tempura de crevettes et sauce sucrée-pimentée",
  "Terrine de campagne maison, cornichons et pain grillé",
  "Bruschetta aux tomates confites, jambon de Parme et mozzarella di bufala",
  "Velouté de butternut, huile de truffe et graines torréfiées",
  "Tataki de thon au sésame, sauce ponzu et avocat",
  "Houmous, falafels croustillants et pain pita chaud",
  "Nems croustillants au porc, salade et menthe fraîche",
  "Carpaccio de bœuf, parmesan, roquette et huile d'olive",
  "Arancini à la mozzarella et sauce tomate au basilic",
  "Salade César façon chef, poulet croustillant et parmesan",
  "Crème brûlée au foie gras et pain toasté",
  "Rillettes de saumon, blinis et crème à l'aneth",
  "Œufs mimosa au crabe et piment d'Espelette",
  "Soupe thaï tom kha au lait de coco et citronnelle",
  "Poireaux vinaigrette à la moutarde de Meaux et noisettes torréfiées",
  "Samoussas aux légumes et chutney de mangue",
  "Tartelette fine aux champignons et crème de parmesan",
  "Huîtres fines de claire, vinaigre à l'échalote et pain de seigle",
  "Panna cotta de petits pois, menthe et jambon cru",
  "Beignets de calamars, sauce tartare et citron",
  "Salade grecque, feta, olives de Kalamata et origan",
  "Crevettes flambées au whisky, ail et persil",
  "Velouté de champignons des bois et chantilly de noisette",
];

const PLATS = [
  "Filet de bœuf Rossini, foie gras poêlé et sauce Périgueux",
  "Risotto crémeux à la truffe noire et copeaux de parmesan",
  "Magret de canard au miel, purée de patate douce et jus réduit",
  "Homard thermidor gratiné et riz pilaf",
  "Côte de bœuf maturée, frites maison et sauce béarnaise",
  "Bœuf Wellington, légumes glacés et jus corsé",
  "Linguine aux palourdes, ail et persil plat",
  "Burger gourmet au wagyu, cheddar affiné, oignons confits et frites",
  "Poulet fermier rôti, pommes grenaille et jus au thym",
  "Pavé de saumon laqué au miso, riz japonais et bok choy",
  "Tajine d'agneau aux abricots, amandes et semoule fine",
  "Blanquette de veau à l'ancienne et riz basmati",
  "Lasagnes à la bolognaise mijotée et béchamel gratinée",
  "Pad thaï aux crevettes, cacahuètes et citron vert",
  "Bœuf bourguignon mijoté 7 heures et tagliatelles fraîches",
  "Saint-Jacques snackées, purée de panais et beurre noisette",
  "Canard laqué à la pékinoise, crêpes fines et sauce hoisin",
  "Tartiflette au reblochon fermier et salade verte",
  "Carré d'agneau en croûte d'herbes et gratin dauphinois",
  "Bouillabaisse marseillaise, rouille et croûtons",
  "Poke bowl au thon, avocat, edamame et riz vinaigré",
  "Paella royale aux fruits de mer et chorizo",
  "Raviolis frais à la ricotta, beurre de sauge et parmesan",
  "Filet de bar, écrasé de pommes de terre à l'huile d'olive et sauce vierge",
  "Butter chicken, riz basmati et naans au fromage",
  "Osso buco à la milanaise et risotto au safran",
  "Pizza napolitaine à la burrata, jambon de Parme et roquette",
  "Cassoulet de Castelnaudary au confit de canard",
  "Ramen tonkotsu, chashu de porc et œuf mariné",
  "Coq au vin, lardons, champignons et purée maison",
  "Fish and chips croustillant, sauce tartare et petits pois à la menthe",
  "Tacos al pastor, ananas rôti, coriandre et guacamole",
  "Suprême de volaille aux morilles et tagliatelles fraîches",
  "Couscous royal — agneau, poulet, merguez et légumes",
  "Entrecôte grillée, beurre maître d'hôtel et frites maison",
  "Gnocchis poêlés à la crème de gorgonzola et noix",
  "Poulet tikka masala, riz parfumé et chutney de mangue",
  "Lobster roll brioché, beurre citronné et chips maison",
  "Parmentier de canard confit et salade de mâche",
  "Bibimbap au bœuf mariné, légumes croquants et œuf",
  "Spaghetti carbonara à la romaine, guanciale et pecorino",
  "Raclette au lait cru, charcuterie fine et pommes de terre",
  "Dos de cabillaud en croûte de chorizo et risotto crémeux",
];

const DESSERTS = [
  "Fondant au chocolat au cœur coulant et glace vanille",
  "Tarte au citron meringuée",
  "Paris-Brest à la crème pralinée",
  "Crème brûlée à la vanille de Madagascar",
  "Tiramisu classique au café et mascarpone",
  "Profiteroles, glace vanille et chocolat chaud",
  "Tarte Tatin tiède et crème fraîche épaisse",
  "Mille-feuille à la vanille",
  "Cheesecake new-yorkais aux fruits rouges",
  "Mousse au chocolat noir et fleur de sel",
  "Baba au rhum et chantilly",
  "Île flottante au caramel et pralines roses",
  "Moelleux aux marrons et crème anglaise",
  "Pavlova aux fruits exotiques et fruit de la passion",
  "Brownie tiède, noix de pécan et glace caramel",
  "Panna cotta à la vanille et coulis de framboise",
  "Forêt-noire à la chantilly et griottes",
  "Crêpes au caramel beurre salé",
  "Éclair au chocolat grand format",
  "Fraisier à la crème mousseline",
  "Tarte fine aux pommes et glace cannelle",
  "Cookie géant tiède, cœur chocolat et glace vanille",
  "Riz au lait crémeux et caramel beurre salé",
  "Opéra au café et chocolat",
  "Saint-Honoré à la crème chiboust",
  "Banoffee pie, banane, caramel et chantilly",
  "Tarte au chocolat et noisettes caramélisées",
  "Café gourmand et ses mignardises",
  "Sablé breton, crème de citron et fraises",
  "Soufflé au Grand Marnier",
  "Macarons assortis et sorbet framboise",
  "Carrot cake et glaçage au cream cheese",
  "Coupe Dame Blanche, chocolat chaud et amandes",
  "Fondant à la pistache, cœur framboise",
  "Clafoutis aux cerises et crème vanille",
  "Tarte aux fraises et crème pâtissière",
  "Tarte Bourdaloue aux poires et amandes",
  "Poire Belle-Hélène",
  "Charlotte aux framboises",
  "Moelleux coco et ananas rôti",
  "Mont-blanc à la crème de marron",
];

// Mélange fixe (graine constante) : l'ordre est le même à chaque redémarrage,
// donc le menu d'un jour donné ne change pas si le bot redémarre.
function seededShuffle(list, seed) {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const ORDERS = {
  petitDej: seededShuffle(PETIT_DEJEUNER, 1),
  entrees: seededShuffle(ENTREES, 2),
  plats: seededShuffle(PLATS, 3),
  desserts: seededShuffle(DESSERTS, 4),
};

// Numéro du jour (heure de Paris), qui avance de 1 chaque jour
function parisDayNumber(date = new Date()) {
  const [y, m, d] = date
    .toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })
    .split("-")
    .map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// La n-ième position d'une liste qui tourne : on la parcourt en entier avant de revenir au début
function nth(order, position) {
  return order[position % order.length];
}

function getMenuForDay(day) {
  return {
    petitDej: nth(ORDERS.petitDej, day),
    midi: {
      entree: nth(ORDERS.entrees, day * 2),
      plat: nth(ORDERS.plats, day * 2),
      dessert: nth(ORDERS.desserts, day * 2),
    },
    soir: {
      entree: nth(ORDERS.entrees, day * 2 + 1),
      plat: nth(ORDERS.plats, day * 2 + 1),
      dessert: nth(ORDERS.desserts, day * 2 + 1),
    },
  };
}

function formatDateFr(date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

function formatCourse(course) {
  return (
    `🥗 **Entrée** — ${course.entree}\n` +
    `🍖 **Plat** — ${course.plat}\n` +
    `🍰 **Dessert** — ${course.dessert}`
  );
}

function buildMenuEmbed(menu, date = new Date()) {
  const dateStr = formatDateFr(date);
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(MENU_TITLE)
    .setDescription(`**${dateStr.charAt(0).toUpperCase()}${dateStr.slice(1)}**`)
    .addFields(
      { name: "☀️ Petit-déjeuner", value: menu.petitDej },
      { name: "🌤️ Déjeuner", value: formatCourse(menu.midi) },
      { name: "🌙 Dîner", value: formatCourse(menu.soir) }
    )
    .setFooter({ text: "Menu de la Maison • Préparé par le chef" });
}

async function findMenuMessages(channel, client) {
  const messages = await channel.messages.fetch({ limit: 15 }).catch(() => null);
  if (!messages) return [];
  return [...messages.values()].filter(
    (m) => m.author.id === client.user.id && m.embeds[0]?.title === MENU_TITLE
  );
}

async function publishDailyMenu(client) {
  const channel = await client.channels.fetch(REPAS_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) {
    console.warn(`Salon repas ${REPAS_CHANNEL_ID} introuvable`);
    return;
  }

  for (const old of await findMenuMessages(channel, client)) {
    await old.delete().catch(() => null);
  }

  const now = new Date();
  await channel.send({
    content: `<@&${MEMBRE_ROLE_ID}>`,
    embeds: [buildMenuEmbed(getMenuForDay(parisDayNumber(now)), now)],
  });

  console.log(`Menu du jour publié — ${formatDateFr(now)}`);
}

// Vérifie dans le salon (pas dans un fichier) si le menu du jour est déjà publié,
// pour ne pas re-mentionner les membres à chaque redémarrage du bot.
async function isMenuPostedToday(client) {
  const channel = await client.channels.fetch(REPAS_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return false;
  const today = parisDayNumber();
  const menus = await findMenuMessages(channel, client);
  return menus.some((m) => parisDayNumber(m.createdAt) === today);
}

function startRepasScheduler(client) {
  cron.schedule(
    "0 6 * * *",
    () => {
      publishDailyMenu(client).catch((err) =>
        console.error("Erreur menu repas:", err.message)
      );
    },
    { timezone: "Europe/Paris" }
  );

  isMenuPostedToday(client)
    .then((posted) => (posted ? null : publishDailyMenu(client)))
    .catch((err) => console.error("Erreur menu repas (démarrage):", err.message));

  console.log("Repas : envoi programmé chaque jour à 6h00 (Paris)");
}

module.exports = {
  REPAS_CHANNEL_ID,
  MEMBRE_ROLE_ID,
  getMenuForDay,
  publishDailyMenu,
  startRepasScheduler,
};
