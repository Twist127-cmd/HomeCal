# Avatar Studio

Ouvrir **Réglages → Profils → un profil → Avatar — ouvrir Avatar Studio**.

Le studio occupe un écran séparé, avec aperçu, catégories, options visuelles, presets rapides, aléatoire cohérent et réinitialisation confirmée. **Terminé** sauvegarde l’avatar d’un profil existant. Pour un nouveau profil, le studio prépare l’avatar ; **Enregistrer** dans le profil sauvegarde les deux ensemble. Retour ou Échap abandonne le brouillon. Une erreur de sauvegarde reste visible dans le studio et conserve les modifications pour réessayer.

## Modèle et rendu

`Profile.avatarConfig` est une configuration JSON optionnelle, version 1. Les anciens avatars emoji/initiales restent compatibles. Adultes, adolescents, enfants, bébés, chiens et chats utilisent un renderer SVG commun, avec relief obtenu par gradients, lumière et ombrages. Aucun moteur 3D, SDK ni service d’image n’est ajouté. Les profils individuels continuent d’utiliser le modèle de calendrier existant, y compris les animaux ; les relations couple/groupe/foyer restent inchangées.

Le catalogue comprend les 15 races de chiens et 11 races de chats demandées. Race, proportions, oreilles, museau, pelage, motifs et queue sont personnalisables. Les humains disposent des catégories Type, Visage, Peau, Cheveux, Yeux, Sourcils, Nez, Bouche, Barbe, Tenue, Accessoires et Fond. La barbe est réservée aux adultes ; bébés et enfants utilisent des proportions et options adaptées.

La sauvegarde d’un avatar existant effectue une mise à jour du seul champ `avatarConfig` dans le document Firestore du profil. Elle ne remplace pas les autres champs modifiés sur un autre appareil. Le schéma est normalisé, les couleurs validées et les choix inconnus écartés avant le rendu et l’écriture.

## Présence et contexte

Les avatars apparaissent dans les profils, les filtres et événements du calendrier, la sélection **Famille**, le widget Profils, les scènes et le mode ambiant. Un profil sans configuration garde son avatar historique, sans lui inventer une apparence.

Le moteur compose des couches : identité → thème → saison/date → heure → scène → contexte live. Les saisons, Noël, Nouvel An, Halloween, rentrée et anniversaires présents dans l’agenda ajoutent des variations discrètes. Les scènes Matin, Cuisine, Soir, Travail et Vacances peuvent adapter les accessoires. Les minuteurs dont le libellé indique une activité de cuisine utilisent aussi cette variante. La lecture Spotify déclenche un petit mouvement ; un départ ou événement imminent déclenche une réaction d’attention. Les vêtements, visage, coiffure et morphologie enregistrés ne sont jamais modifiés par ces variations.

Dans **Réglages → Apparence → Animations avatars**, choisir Réduit, Normal ou Vivant, mémorisé par appareil et foyer. Le contexte est dérivé une fois par minute ou lors d’un changement de scène, thème, lecture ou données. Les animations utilisent CSS, sans boucle JavaScript par avatar. Le renderer est mémorisé ; les icônes inférieures à 48 px restent statiques et les animations sont suspendues lorsque la page est cachée. La nuit réduit les mouvements. `prefers-reduced-motion` arrête les animations.

## Vérification

- Suite métier et schéma : 1 476 tests réussis au total, 8 tests préexistants ignorés ; 29 tests spécifiques aux avatars et à l’écriture Firestore.
- Build Next.js, TypeScript et ESLint.
- Chromium avec les vrais composants et données isolées : six types sur quatre formats d’écran, plusieurs races dont Cocker, Golden Retriever, Labrador, Teckel, Husky, Européen, Maine Coon, Siamois et Bengal.
- Vérification de la sauvegarde, erreur/réessai, annulation, confirmation de réinitialisation, sélection d’un profil et famille de cinq avatars, musique, scène Cuisine, nuit et réduction des mouvements.
- Contrôle des erreurs SVG, des erreurs JavaScript et des débordements horizontaux ; captures dans `.visual/`.

Les règles Firestore existantes autorisent la mise à jour aux membres du foyer ; aucune règle d’accès n’est élargie. Les vérifications visuelles utilisent des données de test. Les performances sur une Lenovo Tab P11 Gen 2 physique et une sauvegarde sur le compte connecté du foyer ne sont pas certifiées par ces essais.
