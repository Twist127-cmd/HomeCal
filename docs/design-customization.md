# Personnalisation HomeCal

Dans **Réglages → Apparence**, les styles et les dispositions sont indépendants.

- 18 presets visuels, regroupés en classiques, saisonniers et extravagants. Toucher un preset ouvre un aperçu ; **Appliquer** le sauvegarde, **Annuler** revient au style enregistré.
- 5 dispositions : Minimal, Maison, Cuisine, Calendrier et Famille.
- **Personnaliser l’accueil** permet de masquer, déplacer, redimensionner et choisir la largeur des 12 widgets. Les poignées acceptent les gestes tactiles ; les flèches permettent aussi le réordonnancement. L’aperçu ne déclenche aucune action métier. Enregistrer applique les changements, Annuler les abandonne.
- Densités Compact, Normal et Confort ; commandes tactiles d’au moins 44 px dans les nouveaux écrans.
- Réinitialisations séparées du style, de la disposition et de l’ensemble.

Les préférences sont locales à chaque navigateur/appareil et foyer. Les anciennes dispositions sont lues sans perdre leur ordre, leurs visibilités ni la taille du widget musical. Le schéma de disposition version 2 conserve la clé historique. Si le stockage est indisponible, les réglages restent utilisables pour la session.

Les widgets Heure, Météo, Prochain événement, Départ, Agenda, Profils, Disponibilités, Musique, Minuteurs, Courses, Maison et Assistant utilisent les données et actions existantes. La mise en avant d’un départ, événement ou minuteur imminent change le contour sans réordonner les cartes. Les scènes et l’écran ambiant conservent le preset comme base.

## Musique

Le widget musical dispose de trois tailles et d’une entrée **Spotify immersif**. Le mode immersif affiche pochette, titre, artiste, progression, commandes Spotify Connect, appareil et volume lorsque l’appareil le prend en charge. Sans titre actif, il présente la bibliothèque et la recherche existantes. Aucune API de favoris ou source de playlist indisponible n’est inventée. La lecture reste une télécommande Spotify Connect : aucun lecteur audio ou SDK de lecture n’est ajouté.

Les couleurs sont extraites de 1 024 pixels maximum, mises en cache pour 64 pochettes et mélangées au preset. Les images manquantes, les erreurs CORS et les erreurs de décodage utilisent une palette et une icône de secours. Pause conserve pochette et palette. Les transitions durent 450 ms ; aucune animation de fond permanente n’est ajoutée. Les niveaux d’adaptation sont Désactivée, Subtile, Normale et Immersive.

Les couleurs de texte, d’accent et de texte sur accent sont calculées pour un contraste d’au moins 4,5:1 sur leur surface. Les zones de texte immersives sont opaques. Les préférences de réduction des mouvements et de transparence sont respectées.

## Vérification

- Suite métier complète : 1 447 tests réussis, 8 tests préexistants ignorés.
- Tests spécifiques : migration des dispositions, tailles et largeurs invalides, intégrité des presets, contrastes de chaque preset en clair/sombre/nuit et de pochettes blanches, noires, monochromes ou saturées.
- Chromium avec données isolées : quatre formats d’écran, 18 presets, cinq dispositions, trois densités, sauvegarde/annulation/réinitialisation, déplacement tactile réel via CDP et flèches, tailles de widgets, largeur complète, scènes et mode ambiant.
- Spotify : ouverture/fermeture immersive, pause, pochettes claires/sombres/saturées, image cassée et état sans lecture ; aucune erreur JavaScript ni débordement horizontal relevé.
- TypeScript, ESLint et build Next.js de production.

Les essais Chromium utilisent les vrais composants et des données de test, sans accéder aux comptes du foyer. Le déploiement public est vérifié séparément. Les performances à 60 images/s sur une Lenovo Tab P11 physique et une commande Spotify sur un appareil réel ne peuvent pas être certifiées depuis cet environnement.
