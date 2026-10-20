// Textes du studio (voir studio.js) : de grandes listes, écrites comme de vrais messages (abréviations, fautes de frappe,
// sans emoji la plupart du temps), pour que rien ne sonne répétitif ni « écrit par une IA ». Jamais explicite.

const NAMES = [
  "Lucas_92", "maxou.dlr", "Kev1n", "TheoB", "nathan.prv", "Romain_31", "jules.off", "Ethan_lvl", "Yanis.k", "Hugo_dsg",
  "Mehdi.75", "Sam_rx", "Axel.vibes", "Noah_fr", "Enzo.cpt", "Adam_wav", "Victor.lmn", "Leo_mtl", "Tom.zen", "Rayan_pdc",
  "kylian.b", "dorian_77", "Bastien.r", "mattéo_lyon", "Ilyes.06", "Florian_tls", "gabin.x", "quentin_brd", "Anthony.v", "Nico_59",
  "jordan.mrs", "Louis_lf", "aurelien.p", "Malik_93", "simon.dz", "Benji_2k", "loic.rn", "Corentin_bzh", "Steven.k", "Alexis_mtp",
  "valentin.c", "Dylan_13", "jeremy.lg", "Karim.zz", "Thibault_nts", "max.lb", "Sofiane_69", "arthur.vrn", "Clement_49", "Ryan.dlc",
  "baptiste_rs", "Medhi.trn", "Lenny_88", "olivier.ct", "Ismael_31", "tristan.v", "Julien_mn", "Morgan.pz", "Adrien_42", "Wassim.k",
  "fabien_lr", "Teddy.bnt", "Mathis_44", "jo.marchal", "Rafael_sx", "Loris.dm", "Kevin_bd", "Yassine.21", "Antoine_rv", "eliott.gn",
  "the_real_marc", "chris.1987", "bg_du_67", "nono.officiel", "pierrot_fr", "Darkvador_75", "cedric.mt", "Seb_nice", "manu.vrt", "Greg_bzh",
  "tonyy", "lolo_59", "fredo.p", "jb.martin", "Anis_95", "Zak.lmn", "mike.rouen", "Hamza_pro", "Steph_33", "david.cr",
];

// messages privés des clients : compliments, questions, demandes, petites nouvelles, relances
const MESSAGES = [
  // compliments
  "Coucou ! J'adore ton dernier post 😍", "franchement ta derniere photo elle est trop belle", "t'es vraiment magnifique sur celle d'hier",
  "Chaque publication est mieux que la précédente, comment tu fais ?", "ton style il est unique sérieux", "j'ai pas pu m'empêcher de te le dire : t'es superbe",
  "trop belle comme d'hab", "Ta tenue de ce matin 🔥", "le fond rose ça te va trop bien", "jsuis fan de ton sourire, voila c dit",
  "Wow. Juste wow.", "t'as un vrai talent pour les photos", "les couleurs sur la dernière série sont dingues", "ton compte c'est ma pause préférée de la journée",
  "honnêtement t'es la meilleure créatrice que je suis", "j'ai montré ta photo à mon pote il était choqué mdr", "ta lumière naturelle elle rend trop bien",
  "c'est fou comme t'es photogénique", "t'as changé de coiffure ? ça te va trop bien", "Toujours aussi classe",
  // questions
  "C'est quand ta prochaine publication ?", "tu postes ce soir ?", "tu postes combien de fois par semaine ?", "t'as prévu quoi ce week-end ?",
  "tu prends les suggestions de thèmes ?", "t'aimes bien quand on te propose des idées ?", "c'est toi qui fais tes photos toute seule ?",
  "T'as un appareil photo pro ou c'est ton tel ?", "tu réponds à tout le monde ou j'ai de la chance ? 😅", "c'est quoi ta photo préférée de toutes ?",
  "tu fais des promos de temps en temps ?", "y'aura d'autres photos de la série d'hier ?", "elle vient d'où ta tenue d'hier ?",
  "tu ferais une série en tenue de soirée ?", "Tu pourrais faire une série photo à la plage ?", "tu partirais pas en vacances bientôt ? ça ferait de belles photos",
  "c'est quand l'anniversaire de ton compte ?", "tu feras une série spéciale pour noël ?", "elle est où la photo avec la veste en jean ? je la retrouve plus",
  "t'as combien d'abonnés maintenant ?", "le prix de l'abo il va augmenter ?", "tu fais un tarif pour les anciens abonnés ?",
  "Tu peux refaire le même genre que vendredi ?", "tu préfères la couleur ou le noir et blanc ?", "c'est quel filtre que t'utilises ?",
  "tu vis dans quelle ville ? (t'es pas obligée de répondre hein)", "tu dors jamais ou quoi ? t'as posté à 2h du mat 😂", "t'es plutôt matin ou soir pour les photos ?",
  "si je te propose un thème tu le fais ?", "t'aimes bien quand on te fait des suggestions ?",
  // demandes
  "c'est mon anniv aujourd'hui, une nouvelle photo ce serait le meilleur cadeau 🎂", "t'es encore plus belle sans filtre je suis sûr",
  "fais plus de photos en extérieur stp", "jveux trop une série avec la robe noire", "Refais celle avec le chapeau, elle était parfaite",
  "une série rétro années 80 ça serait ouf", "mets la suite de la série d'hier stp jsuis en manque", "j'ai débloqué ta dernière publication direct",
  "je débloque tout ce que tu postes, t'inquiète", "fais une série sur ta journée ça serait cool",
  // vie, petites nouvelles
  "Je viens de m'abonner, hâte de voir la suite !", "re-abonné après une pause, tu m'avais manqué", "j'ai enfin eu ma paie donc je reprends l'abo 😂",
  "première fois que j'écris à quelqu'un sur un site comme ça, sois indulgente 😅", "mon pote m'a parlé de toi, il avait raison", "je suis là depuis le premier jour, fidèle au poste",
  "petite journée de taf horrible, ton post m'a remonté le moral", "en pause au boulot et je tombe sur ta photo, merci", "je vois que t'as plein de nouveaux abonnés, bien mérité",
  "jsuis malade au lit, tes photos c'est mon médicament", "bonne chance pour ta semaine !", "J'espère que tu passes une bonne journée",
  "bonne nuit, à demain pour la suite 🌙", "Bonjour bonjour ☀️", "coucou toi", "hey ça va ?", "salut ! ça fait longtemps que je t'ai pas écrit",
  "désolé pour le message d'hier j'étais fatigué mdr", "je t'envoie un petit pourboire pour ton café ☕", "Petit pourboire pour ta journée",
  // remerciements, relances
  "Merci pour ta réponse d'hier, t'es la meilleure", "tu réponds toujours, j'apprécie trop", "merci pour la série du week-end, elle valait le coup",
  "t'as pas vu mon message d'avant-hier ?", "je relance au cas où 😇", "pas de souci si tu réponds pas tout de suite hein",
  "ton contenu vaut chaque centime", "je recommande ton compte à tous mes potes", "meilleur abonnement que j'ai jamais pris franchement",
  "jsuis content d'être abonné, voilà c'est tout", "j'aime bien ton humour dans les légendes", "ta légende d'hier m'a fait rire",
  // courts / spontanés
  "😍", "🔥🔥", "magnifique", "incroyable", "t'es trop belle", "ouf", "trop bien", "j'adore", "encore !", "la classe",
  "j'en reviens pas", "sublime", "sans mots", "😳😳", "jsuis fan", "wow", "trop stylé", "parfaite comme d'hab",
  // un peu plus longs
  "je sais pas si tu lis tous tes messages mais je voulais te dire que ce que tu fais est vraiment soigné, ça se voit que tu bosses dur",
  "j'ai découvert ton compte par hasard et j'ai tout regardé en une soirée 😂 t'as gagné un abonné",
  "tu devrais faire des séries à thème chaque semaine, genre lundi plage, vendredi soirée, ça serait trop bien",
  "honnêtement je paye pas beaucoup d'abonnements mais le tien je le garde",
  "j'ai vu que t'avais eu des critiques, t'inquiète pas t'es au top, ignore les rageux",
  "je voulais juste dire que tu réponds avec gentillesse et ça fait plaisir, c'est pas le cas partout",
];

// commentaires sous les publications
const COMMENTS = [
  "Magnifique", "Wow…", "La plus belle publication de la semaine", "J'attendais ça depuis hier !", "T'es incroyable ✨", "Ce sourire 😳",
  "Encore, encore", "Top comme toujours", "J'adore la lumière sur celle-là", "Abonné à vie", "😍😍😍", "🔥", "trop belle",
  "la meilleure", "sublime", "jsuis sans voix", "ok je suis amoureux", "magnifique comme d'hab", "tu brilles", "elle est parfaite celle-là",
  "la tenue 🔥", "j'adore le décor", "les couleurs !!", "photo de l'année", "t'as tout cassé", "trop stylée", "j'ai liké direct",
  "le regard 😳", "frrr t'es belle", "c'est une œuvre d'art", "encore une réussite", "je m'en lasse pas", "jpp t'es trop belle",
  "qui a pris la photo ? il mérite une prime", "le cadrage est parfait", "celle-là je la garde en fond d'écran mdr", "wow le filtre",
  "j'arrive trop tard mais 😍", "premier !", "j'étais le premier à liker 😎", "comment t'es si belle à 8h du mat", "ça change de d'habitude, j'aime",
  "plus de photos comme ça stp", "ça c'est du contenu", "le style 👌", "toujours au top", "rien à dire", "simplement parfaite",
  "elle est trop bien cette série", "j'adore ce look", "ton meilleur post", "là t'as fait fort", "on veut la suite", "la suite quand ?",
  "c'est où ce lieu ?", "elle vient d'où la robe ?", "trop de classe", "ça me met de bonne humeur", "le sourire qui tue",
  "tu rayonnes", "jolie", "très jolie", "superbe photo", "belle photo", "photo incroyable", "t'as trop de goût",
  "c'est beau", "ça claque", "merci pour celle-là", "enfin une nouvelle photo", "je l'attendais", "parfait pour finir la journée",
  "parfait pour commencer la journée", "j'aime bien ce côté naturel", "t'es encore plus belle sans maquillage", "la vibe est trop bien",
  "trop mignonne", "ce côté rétro j'adore", "on dirait un magazine", "digne d'une couverture", "pro de chez pro", "😮", "😍", "🔥🔥", "❤️",
];

const THANKS = [
  "Merci pour ta réponse 😍", "Tu m'as fait ma journée !", "Trop gentille, je reste abonné à vie", "Ahh merci, j'attends la suite avec impatience",
  "omg tu m'as répondu 😳", "merci beaucoup !!", "trop sympa merci", "t'es adorable", "ça me fait plaisir que tu répondes", "merci ma belle",
  "ok trop bien merci", "génial merci !", "merci pour ta gentillesse", "tu gères, merci", "parfait merci 🙏", "jsuis trop content merci",
  "merci d'avoir pris le temps", "trop cool, à bientôt alors", "ça marche, merci !", "t'es la meilleure", "haha merci", "merci, j'attends ça alors",
  "trop contente que tu répondes aussi vite", "merciii", "super, merci beaucoup", "ça fait plaisir 😊", "merci, bonne soirée à toi", "top merci",
];

const REVIEWS = {
  5: [
    "Toujours au top, rien à dire", "Meilleur abonnement que j'ai pris", "Contenu de qualité et réponses rapides", "Elle prend le temps de répondre à tout le monde, rare !",
    "parfait, je recommande à 100%", "jamais déçu depuis que je suis abonné", "les publications valent vraiment le déblocage", "créatrice adorable et contenu soigné",
    "5 étoiles c'est pas assez", "le meilleur compte que je connaisse", "qualité pro, réponses gentilles, que demander de plus", "abonné depuis le début et toujours content",
    "photos magnifiques, publication régulière", "elle écoute les suggestions, j'adore", "excellent, foncez", "rien à redire, top",
  ],
  4: [
    "Très bien, un peu cher mais ça vaut le coup", "Super contenu, j'aimerais juste plus de publications", "Bonne surprise, je recommande",
    "très bon compte, les réponses mettent parfois un peu de temps", "contenu top, j'aimerais plus de séries à thème", "presque parfait, il manque juste un peu de régularité",
    "bien, les séries sont chouettes", "je suis content de mon abonnement", "bon rapport qualité prix", "très sympa, quelques photos se ressemblent un peu",
    "belle découverte", "j'attends les prochaines séries avec impatience",
  ],
  3: [
    "Pas mal, mais les réponses mettent du temps", "Correct, j'attendais un peu plus de nouveautés", "bien mais un peu cher pour ce que c'est",
    "sympa mais pas assez de publications à mon goût", "moyen ce mois-ci, j'espère que ça va repartir", "ça dépend des semaines",
    "j'ai écrit plusieurs fois sans réponse, dommage", "contenu ok, sans plus", "bien au début, un peu moins en ce moment",
  ],
};

module.exports = { NAMES, MESSAGES, COMMENTS, THANKS, REVIEWS };
