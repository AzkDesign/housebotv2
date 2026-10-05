// Fiches artistiques des créatures des Cartes de la Maison.
// Chaque carte garde son nom, son concept, ses statistiques, sa rareté et son numéro :
// seule son illustration est une créature originale qui incarne ce concept.
// Les fiches servent à générer les illustrations (scripts/generer-illustrations.js)
// et donnent l'« élément » visuel qui règle l'ambiance de la carte (couleurs, particules).

// Charte artistique commune à toute l'extension
const STYLE =
  "Premium collectible creature card illustration, original creature design. " +
  "Hand-painted 2D digital painting with bold clean linework, rich cel shading and soft painterly rendering, " +
  "vibrant saturated palette, strong rim lighting, cinematic lighting with glowing highlights. " +
  "Dynamic action scene: the creature is mid-action in an expressive pose with a strong recognizable silhouette, " +
  "expressive eyes and face, coherent anatomy, dramatic perspective (low angle or foreshortening), " +
  "detailed environment with depth and atmosphere, energy effects and particles tied to its power. " +
  "Consistent visual language for a whole official card expansion. ";
const AVOID =
  "No text, no letters, no numbers, no logo, no watermark, no card frame, no border, no UI. " +
  "No humans, no human characters. Not photorealistic, not a 3D render, no plastic look, no empty background, no static pose. " +
  "Do not copy any existing character, franchise or card.";

// Éléments visuels (ambiance) : ils ne changent pas le type de combat de la carte
const ELEMENT_MOODS = {
  feu: "fire element: flames, embers, explosions of heat, warm orange and crimson palette",
  eau: "water element: crashing waves, splashes, droplets, deep blue and turquoise palette",
  foudre: "lightning element: crackling electric bolts, sparks, violet and electric blue palette",
  nature: "nature element: lush vegetation, leaves, petals, vines, green and blossom palette",
  ombre: "shadow element: swirling dark energy, mist, violet glow, deep purple and black palette",
  chance: "luck element: golden coins, glittering treasure, beams of golden light, amber and gold palette",
  lumiere: "light element: radiant beams, prismatic glow, sparkles, white gold and soft pink palette",
  air: "wind element: swirling gusts, clouds, speed streaks, feathers, pale teal and white palette",
  pierre: "earth element: shattering rock, stone shards, dust clouds, ochre and bronze palette",
  glace: "ice element: frost crystals, snow flurries, icy mist, cyan and white palette",
};

// [créature, action et scène, élément]
const FICHES = {
  // --- Paris (Génération 1) ---
  p_belleville: ["a small acrobatic chameleon-lizard whose scales are covered in colorful street-art patterns", "leaping between laundry lines over the rooftops of a lively Paris working-class quarter at sunset, spraying an arc of rainbow paint from its curling tail", "nature"],
  p_seine: ["a playful otter-dragon made of flowing river water with cobblestone-grey fins", "surfing a curling wave under an old stone bridge on the river in Paris, splashing droplets everywhere", "eau"],
  p_metro: ["a mechanical centipede creature with white tiled segments and glowing headlight eyes", "bursting out of a dark subway tunnel in a rush of wind, sparks flying from its legs on the rails", "foudre"],
  p_croissant: ["a fluffy golden pastry-dragon whelp with flaky croissant-layered scales and buttery steam breath", "tumbling out of a glowing bakery oven at dawn amid flour clouds and warm sparks", "feu"],
  p_baguette: ["a long ferret-like creature with a crusty bread-patterned back and a wheat-ear tail", "dashing across a market stall in a burst of flour and crumbs, wheat stalks swirling", "nature"],
  p_cafe: ["a small round owl made of steaming coffee foam with espresso-brown feathers", "swooping off a Parisian café terrace chair, trailing swirls of aromatic steam", "air"],
  p_pigeon: ["a proud chunky grey pigeon-griffin with an iridescent neck mane and a tiny crest crown", "landing with wings spread wide on a rain-soaked Paris square, puddles splashing", "air"],
  p_marais: ["a nocturnal moth-cat with lantern-glowing wings patterned like old wooden shutters", "gliding through hidden cobblestone courtyard archways at night among fireflies", "ombre"],
  p_montmartre: ["an artist fox-chameleon with a beret-shaped crest and a paintbrush tail", "painting the air with trails of vivid colors as it bounds up the steps of a hilltop artists' village", "lumiere"],
  p_champs: ["a sleek luminous stag with crystal antlers glowing like city lights", "galloping down a grand illuminated avenue at night, leaving long light trails behind it", "lumiere"],
  p_bateau: ["a glass-bellied turtle creature with lantern lights on its shell and paddle fins", "gliding along the river at dusk as waves curl around it, city lights reflecting on the water", "eau"],
  p_luxembourg: ["a dainty flower-deer with tulip petals growing along its back and leaf-shaped ears", "leaping through blooming garden beds as a whirlwind of petals swirls around it", "nature"],
  p_haussmann: ["a regal stone-and-gem gargoyle beast with diamond inlays and carved molding patterns", "roaring from an ornate cream-stone balcony as crystal shards burst outward", "pierre"],
  p_notredame: ["a gothic guardian gargoyle-dragon with stained-glass wings blazing with colored light", "perched on a cathedral spire during snowfall, wings flared wide, light beaming through its wings", "lumiere"],
  p_opera: ["a theatrical phoenix-songbird with velvet-red and gold plumage and flames shaped like musical notes", "singing on a grand opera stage under a giant crystal chandelier as golden notes swirl", "feu"],
  p_moulin: ["a twirling cabaret fire-fox with ruffled skirt-like fur and a windmill-blade tail", "spinning in a wild dance on a red-lit cabaret stage surrounded by confetti and sparks", "feu"],
  p_eiffel: ["a colossal dragon whose body is built of riveted wrought-iron latticework", "coiling around a giant iron tower at night, sparkling with thousands of golden lights, roaring with electric glow", "foudre"],
  p_louvre: ["a sphinx-like museum guardian cat with a glass-pyramid crystal on its forehead and painted-canvas wings", "emerging from a giant golden picture frame as swirls of painted colors pour out", "lumiere"],
  p_catacombes: ["a spectral wraith creature made of carved ossuary bones with candle-flame eyes", "rising from dark underground tunnels in swirling purple shadow mist", "ombre"],
  p_versailles: ["a majestic sun-lion with a radiant golden mane shaped like sun rays and a jeweled crown", "roaring in a hall of mirrors that reflects blazing golden sunlight in every direction", "lumiere"],
  p_ame: ["an ethereal celestial spirit-dragon made of starlight and night sky, holding a glowing golden key in its claws", "soaring above the lights of Paris inside a vortex of stars and golden light", "lumiere"],
  // --- La Maison (Génération 1) ---
  m_double: ["a sleepy two-headed koala-like creature, one head yawning while the other giggles", "bouncing on a big bed in a joyful pillow fight, pillows bursting into clouds of feathers", "air"],
  m_repas: ["a cheerful little chef salamander with a dinner-plate shaped shell", "flipping a steaming dish high from a pan in a cozy kitchen, fiery sparks flying", "feu"],
  m_valise: ["a sturdy armadillo whose rolled-up shell is a vintage travel suitcase covered in stickers", "rolling at full speed across a train station hall, leaving a trail of dust", "pierre"],
  m_contrat: ["a scholarly quill-bird with ink-black feathers and a fountain-pen beak", "signing a glowing contract in mid-air as ribbons of ink swirl around it", "ombre"],
  m_croupier: ["a sly card-shark fox with playing-card shaped ears and a jester collar", "dealing a fan of glowing cards that fly through the air above a green felt gaming table", "chance"],
  m_urne: ["a hermit crab carrying a wooden ballot box as its shell", "raising a glowing ballot paper triumphantly as voting papers flutter around a grand town hall", "lumiere"],
  m_airbnb: ["a welcoming snail whose shell is a tiny cottage with a garden and lit windows", "gliding along a flowered path as petals drift in warm evening light", "nature"],
  m_facture: ["a crafty moth made of folded receipts and invoices", "whirling through the air in a spiral, scattering golden coins and paper slips", "chance"],
  m_suite: ["an elegant velvet-furred panther with glowing eyes", "springing mid-pounce off a luxurious sofa in a lavish suite, lamp light streaking", "ombre"],
  m_casino: ["a raccoon whose belly is a slot machine, with a lever for an arm", "pulling its own lever as triple sevens flash and coins explode everywhere in a neon casino", "chance"],
  m_mairie: ["a stately tortoise whose shell is a classical columned town hall", "stomping forward as radiant golden laurel light bursts around it", "pierre"],
  m_irf: ["a sharp-eyed investigator owl with a magnifying-glass monocle that projects a scanning beam", "swooping through towering stacks of files in a dark office, beam sweeping", "foudre"],
  m_cle: ["a golden ferret with a key-shaped tail", "darting through a doorway of light, its tail unlocking glowing keyholes floating in the air", "chance"],
  m_penthouse: ["a sleek falcon made of glass and skyline lights", "diving from a penthouse rooftop at night, wings blazing like lit skyscraper windows", "air"],
  m_code: ["an ancient serpent made of parchment covered in glowing runes of law", "uncoiling dramatically as golden letters and seals swirl around it", "lumiere"],
  m_star: ["a radiant star-shaped celebrity creature with a glittering five-pointed body and big expressive eyes", "striking a confident pose on stage under crossing spotlights in a storm of sparkles", "lumiere"],
  m_jackpot: ["a giant dragon whose scales are golden coins and whose belly is a money bag", "bursting out of a treasure vault, roaring a torrent of gold coins and jewels", "chance"],
  m_maire: ["a noble griffin with a medal crest and a ceremonial sash", "spreading its wings on the grand steps of a town hall as confetti and golden light burst", "lumiere"],
  m_papillon: ["a magnificent butterfly creature with stained-glass wings in deep red and gold, the emblem of the House", "rising in a storm of glowing wing-dust above a grand mansion", "nature"],
  m_dictateur: ["an imposing armored war-boar with crossed-sword tusks and a dark red banner cape", "charging through a throne room as crimson lightning crackles", "ombre"],
  m_fondation: ["a colossal ancient tortoise titan carrying a castle with towers and banners on its shell, glowing with founding runes", "rising from a sea of clouds inside a celestial aurora", "pierre"],
  // --- Le Grand Voyage (Génération 2) ---
  v_avion: ["a streamlined swallow creature with jet wings, airliner-white plumage and turbine cheeks", "banking hard through towering clouds, leaving long contrails", "air"],
  v_carte: ["a curious axolotl whose skin is printed with continents like a world map", "swimming through a sea of parchment as glowing compass roses appear", "eau"],
  v_sac: ["a sturdy beetle whose shell is a backpack with buckles and pockets", "climbing a steep mountain trail at sunrise as pebbles tumble", "pierre"],
  v_photo: ["a chameleon with a big glowing camera-lens eye", "snapping a dazzling flash burst in a lively night market", "foudre"],
  v_boussole: ["a hedgehog with a compass face whose quills point like needles", "spinning on a giant parchment map as glowing direction arrows burst out", "air"],
  v_billet: ["an origami fox made of folded train tickets", "racing alongside a train on a station platform in a gust of steam and wind", "foudre"],
  v_plage: ["a sunny crab with a beach-parasol shaped shell and sandy fur", "splashing joyfully in turquoise waves on a sunlit beach", "eau"],
  v_tgv: ["a bullet-shaped serpentine creature with high-speed train livery", "streaking past vineyards in a blur of speed lines and electric sparks", "foudre"],
  v_croisiere: ["a gentle giant whale with a cruise-ship deck on its back and porthole spots", "breaching from the sea at sunset in a huge splash", "eau"],
  v_newyork: ["a teal lion statue creature come to life, holding a torch in its paw", "roaring atop a skyscraper as city lights and fireworks blaze below", "lumiere"],
  v_londres: ["a crab with ferris-wheel gondolas for claws", "spinning its wheel-claws while striding along a river embankment in the rain", "eau"],
  v_ile: ["a sea turtle carrying a tiny tropical island with a palm tree on its shell", "swimming through a crystal lagoon among colorful tropical fish", "nature"],
  v_fuji: ["a mountain spirit tortoise whose shell is a snow-capped sacred mountain", "rising at sunrise as cherry blossoms and snowflakes swirl together", "glace"],
  v_kyoto: ["an elegant nine-tailed fox spirit with pagoda-roof ornaments and flame-tipped tails", "dancing among glowing temple lanterns and falling cherry petals", "feu"],
  v_istanbul: ["a mosaic-scaled serpent with a domed crest and golden minaret horns", "coiling between two continents above a strait at dusk", "lumiere"],
  v_volcan: ["a molten rock salamander dripping with lava", "erupting from a volcano crater as ash and embers explode", "feu"],
  v_fusee: ["a rocket-bodied space shark with fin thrusters", "blasting off into orbit trailing fire and stars", "feu"],
  v_sahara: ["a giant scorpion-sphinx with a golden carapace", "emerging from the dunes in a swirling sandstorm under a blazing sun", "pierre"],
  v_aurore: ["a cosmic deer with antlers made of the milky way and aurora-colored fur", "galloping across a starry sky above a desert", "ombre"],
  v_paques: ["a towering stone-headed golem awakened with glowing ancient eyes", "rising from the island grass as stone shards levitate around it", "pierre"],
  v_tourdumonde: ["a world dragon carrying a glowing globe with continents on its back", "soaring through space among orbiting planets and routes of light", "lumiere"],
  // --- Événements ---
  ev_star: ["a shooting-star fox with a glittering comet tail", "leaping across a spotlight-lit stage in a shower of stars", "lumiere"],
  ev_maire: ["a laurel-crowned eagle with feathers like ballot papers", "rising as thousands of ballot papers swirl like confetti in golden light", "lumiere"],
  ev_jackpot: ["a winged lucky cat with golden coin wings", "exploding out of a slot machine in a shower of banknotes and coins", "chance"],
  ev_champion: ["a champion dragon with a golden trophy-shaped crest", "roaring victoriously in a grand arena under fireworks and pillars of light", "feu"],
  ev_podium: ["a pegasus with a glowing medal on its chest", "rearing up on a podium under spotlights and confetti", "lumiere"],
  sh_trefle: ["a radiant emerald four-leaf-clover fairy creature with shimmering green crystal wings", "bursting out of a glowing meadow in a whirlwind of green sparkles and clover leaves, everything bathed in emerald light", "nature"],
  // --- Entreprises (une créature par secteur, partagée par les entreprises du secteur) ---
  sector_transport: ["a swift cheetah creature with taxi-yellow fur and checkered stripes", "speeding through rainy night streets with headlight light trails", "air"],
  sector_restauration: ["a fire salamander with a chef-hat crest", "tossing flaming dishes in a busy restaurant kitchen", "feu"],
  sector_garage: ["a mechanical beetle with wrench-shaped claws", "shooting sparks while repairing a roaring engine in a workshop", "foudre"],
  sector_beaute: ["a graceful lotus swan with glossy petal feathers", "gliding through spa steam and sparkles", "nature"],
  sector_evenementiel: ["a peacock whose tail feathers are bursting party poppers", "fanning its confetti tail at a glowing festival", "lumiere"],
  sector_securite: ["an armored rhino guardian with a shield-shaped shell", "charging forward behind a glowing protective barrier", "pierre"],
  sector_media: ["a bat creature with camera-flash eyes and antenna ears", "broadcasting waves of light over a city at night", "foudre"],
  sector_immobilier: ["a giraffe whose back is lined with glass skyscrapers", "striding through a city skyline at dusk", "pierre"],
  sector_commerce: ["a kangaroo with a shopping-bag pouch full of glowing goods", "hopping through a busy market tossing golden coins", "chance"],
};

// Clé d'illustration d'une carte : les entreprises partagent celle de leur secteur
const illustrationKey = (card) => (card.id.startsWith("co_") ? `sector_${card.sector ?? "commerce"}` : card.id);

module.exports = { STYLE, AVOID, ELEMENT_MOODS, FICHES, illustrationKey };
