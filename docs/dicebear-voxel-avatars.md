# HomeCal — DiceBear Voxel Art

La refonte remplace le dessin humain HomeCal par le style officiel **DiceBear Voxel Art**, gratuit sous CC0. `@dicebear/core` 10.7.0 et `@dicebear/styles` 10.6.0 sont épinglés. Seule la définition `voxel-art.json` est importée. Aucun serveur d’images, appel à l’API DiceBear ou moteur 3D n’est nécessaire. La génération fonctionne localement avec les ressources déjà chargées de l’application.

Sources : [style et licence](https://www.dicebear.com/styles/voxel-art), [bibliothèque JavaScript officielle](https://www.dicebear.com/integrations/javascript/).

## Options réellement disponibles

Le catalogue du studio lit les variantes et palettes de la définition installée : 21 coiffures/couvre-chefs, 8 regards, 4 sourcils, 4 nez, 10 expressions, 3 joues, 4 barbes, 5 lunettes et 10 tenues. Les groupes de couleurs sont peau, cheveux, couvre-chef, haut, pantalon, chaussures, veste et fond. Les éléments facultatifs utilisent les probabilités réelles du moteur. Les anciennes options de forme du visage, volume/texture libre des cheveux ou iris colorés humains ne sont plus présentées comme des fonctions DiceBear.

Le composant natif d’animation de Voxel Art est fixé à `none`. HomeCal gère indépendamment le comportement, ce qui permet de respecter les préférences, le contexte et la mise en pause en arrière-plan.

## Identité, migration et sauvegarde

`HomeCalAvatarConfig` version 2 conserve `engine`, `style`, `type`, `seed`, `options`, le niveau d’animation et les deux interrupteurs saison/contextes. Le type de profil du calendrier reste inchangé : les humains et animaux demeurent des profils individuels.

Un ancien profil est converti en mémoire à partir de son identifiant interne. La seed opaque est stable et ne dépend pas du nom ou de l’adresse e-mail. Les couleurs et les choix anciens ayant un équivalent sont repris. Aucun ancien document n’est écrasé au simple affichage. La validation dans Avatar Studio enregistre uniquement `avatarConfig` et `avatarSeed`, sans toucher au nom, aux agendas, aux relations ni aux autres champs. Pour un nouveau profil, le studio garde un brouillon jusqu’à l’enregistrement du profil.

Aléatoire crée une nouvelle seed et résout les choix natifs avant de les afficher dans les commandes. Réinitialiser revient au preset HomeCal du type sélectionné avec confirmation. Retour/Échap abandonne le brouillon. Une erreur de sauvegarde conserve l’édition et permet de réessayer.

## Animaux et accessoires HomeCal

Voxel Art ne fournit pas de chiens/chats natifs. Les **26 sprites SVG HomeCal** sont donc des assets locaux dédiés dans `public/avatars/voxel/` : 15 chiens et 11 chats, avec oreilles, museaux, motifs, silhouettes et queues distincts. Ils sont dessinés dans la même projection isométrique et reprennent les trois faces éclairées des voxels. `scripts/generate-voxel-pets.mjs` produit les assets et leur catalogue incorporé ; aucune construction de personnage en div CSS n’est utilisée.

La toque, la casserole, le tablier, la tasse, les bonnets, la casquette, les accessoires de fêtes, les fleurs et le foulard appartiennent à HomeCal. La cuisine remplace le couvre-chef saisonnier et supprime les accessoires incompatibles. Les saisons et thèmes peuvent choisir un bonnet, une casquette ou un foulard, sans recolorer l’identité. Les interrupteurs enregistrés dans le studio permettent de désactiver séparément les variantes saisonnières et contextuelles.

## Animation et calendrier

L’accueil et le calendrier d’un profil disposent d’une zone de promenade délimitée. Les jambes officielles sont groupées pour les petits pas, sans modifier les chemins de DiceBear. La marche alterne déplacement, arrêt, regard et reprise ; un miroir animé assure le changement de direction du personnage isométrique. Ce n’est pas une rotation 3D ou une vraie vue latérale native fournie par DiceBear. La vue Famille garde les noms visibles, des proportions adaptées aux enfants/bébés/animaux et des délais indépendants. Certains personnages se déplacent légèrement tandis que les autres restent au repos.

Spotify en lecture déclenche un balancement léger ; en pause ou arrêté, les personnages reviennent au repos. Les départs/événements proches ont priorité, la nuit reste quasi statique. Un saut bref accompagne la validation d’un avatar et peut être essayé dans le studio ; il ne tourne pas en boucle. Les niveaux Réduit, Normal et Vivant limitent les mouvements, avec priorité au niveau le plus discret entre profil et appareil.

Les options Afficher les avatars et Activer la promenade restent disponibles dans Apparence. La nuit et le niveau Réduit mettent la marche au repos, conformément à cette refonte. La réduction des mouvements du système désactive marche, saut et danse ; une explication est affichée dans les réglages. Les animations sont suspendues lorsque le document devient invisible.

## Performance, repli et vérification

Le cache de SVG humains est borné à 128 identités/variantes ; celui des animaux à 64. Les options normalisées, la seed et le masquage temporaire de la coiffure constituent la clé. Une minute d’horloge ne régénère pas l’identité inchangée. Les identifiants SVG sont isolés par instance pour éviter les collisions entre l’aperçu et les vignettes. Les icônes et vignettes restent statiques. Les animations utilisent CSS et transform, sans calcul de rendu par frame. Un échec du générateur affiche le SVG voxel HomeCal local par défaut.

Les tests couvrent l’audit de toutes les variantes du package, les seeds, les migrations, les options invalides, le cache, les 26 sprites, les conflits de contexte, les écritures ciblées et le repli. La vérification Chromium utilise les vrais composants et des données isolées : six types sur quatre formats, plusieurs races, édition live, aléatoire, sauvegarde/annulation/réinitialisation/erreur-réessai, promenade mesurée en temps réel, pauses/demi-tour, saut, cuisine, saisons, Spotify actif/en pause/arrêté, calendrier de profil/famille, nuit, options persistantes et réduction des mouvements. Le rapport est `.visual/voxel-report.json` ; les captures sont dans `.visual/`.

Les essais isolés ne certifient pas les performances sur une Lenovo Tab P11 Gen 2 physique ni une écriture sur le compte Firebase de l’utilisateur.
