# Illustrations des créatures

Chaque carte des Cartes de la Maison est illustrée par une **créature originale** qui incarne son concept.
Les fiches artistiques (créature, scène, élément) et la charte commune sont dans `fiches.js`.
Les images générées vont dans `images/<clé>.jpg` : le bot les utilise automatiquement, et garde
l'ancienne illustration pour les cartes qui n'en ont pas encore.

## Générer les illustrations

1. Créez une clé API sur la plateforme OpenAI (facturation à l'usage).
2. Dans un terminal, depuis le dossier du bot, définissez la clé **dans votre session uniquement** :
   - PowerShell : `$env:OPENAI_API_KEY = "votre-clé"`
   - Git Bash : `export OPENAI_API_KEY="votre-clé"`
3. Lancez : `node scripts/generer-illustrations.js`
   - le script génère seulement les images manquantes, deux à la fois, avec trois essais en cas d'erreur ;
   - `--apercu` affiche les consignes envoyées sans rien générer ;
   - `--cartes=p_eiffel,m_casino --refaire` régénère des cartes précises (si une image ne plaît pas).
4. Regardez les images dans `images/`, régénérez celles qui ne conviennent pas, puis committez le dossier.

Formats : paysage 1536×1024 pour les cartes classiques, portrait 1024×1536 pour les mythiques (pleine page).
Les entreprises partagent une créature par secteur (`sector_transport`, `sector_garage`…).
Les cartes de membres gardent la photo du membre.
