# HomeCal · Premium Warm UI

Référence : `Downloads/HomeCal_Premium_Warm_UI.md`.

## Audit et changements

L’accueil utilisait directement la grille hebdomadaire, une barre d’outils dense et un dock réservé au téléphone. Les composants partageaient déjà des tokens Tailwind et les providers étaient séparés de la présentation.

La vue Aujourd’hui devient l’accueil sur tous les appareils : salut, date, heure, météo réelle, prochain événement, départ calculé et widgets utiles. Le calendrier garde ses quatre vues et toutes ses actions. Le dock fonctionne sur tablette et ordinateur, avec une version compacte sur mobile.

Palette crème / bois / ambre, surfaces chaudes opaques à 88–94 %, blur limité au dock, typographie plus aérée, états vocaux subtils, lecteur Spotify avec progression et tailles Compact / Standard / Large. Les voix restent celles réellement disponibles sur l’appareil. Maison expose les scènes existantes : aucune commande domotique fictive.

La disposition se masque, se réordonne par glisser-déposer ou par flèches tactiles, et se restaure dans un mode explicite. Sauvegarde locale versionnée par foyer. La musique apparaît pendant la lecture et les minuteurs seulement lorsqu’ils sont actifs. Les courses affichent cinq articles et proposent Annuler.

Le mode ambiant utilise un paysage SVG local léger ; les scènes Matin / Cuisine / Soir conservent leurs widgets, horaires et comportements. Firebase, Ollama, wake word, TTS, Spotify, PWA et les réglages métier restent inchangés.

## Validation

- Tests des frontières horaires et de la lecture des dispositions corrompues ou anciennes.
- Tests du déplacement immuable et du cycle sauvegarde / restauration.
- Workflow GitHub : TypeScript, ESLint, suite Vitest et build Next.
- Focus visible, sélection clavier du calendrier, boutons tactiles, live region pour les notifications et reduced motion.
- Vérifier visuellement 390×844, 820×1180, 1200×800 et 1440×900, en clair/sombre et pour les quatre périodes.
- Tester sur une vraie Lenovo Tab P11 Gen 2 pour confirmer fluidité, consommation et interactions tactiles. L’émulation ne mesure pas l’autonomie réelle.

Aucune nouvelle intégration ni voix inventée. Pas de dépendance d’interface supplémentaire.
