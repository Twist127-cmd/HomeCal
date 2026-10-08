# HomeCal

Calendrier familial tactile et intelligent — pensé pour un écran mural (Raspberry Pi + Chromium kiosk), utilisable aussi sur mobile, tablette et ordinateur.

> **Toucher quand c'est plus rapide. Parler quand c'est plus naturel. Voir immédiatement ce qui compte.**

## Fonctionnalités (V1)

- Calendrier multi-profils (personnes, couple, groupe, foyer) — vues **jour / semaine / mois / agenda**
- CRUD complet des événements, récurrence (quotidienne, hebdo multi-jours, mensuelle, annuelle, exceptions)
- **Ajout rapide** en français : « Dentiste jeudi 16h », « Restaurant vendredi à 20h pour nous deux »
- **Assistant local** (Ollama) avec *tool calling* + **commande vocale** (Web Speech) + **synthèse vocale**
- **Météo** par événement (Open-Meteo), **trajets** et **heure de départ conseillée** (OSRM / OpenStreetMap)
- Détection de **conflits** (chevauchements, temps de trajet insuffisant)
- Recherche de **disponibilités communes**
- **Rappels** (in-app, voix, notifications) et alertes « il est temps de partir »
- **PWA** (installable, cache hors ligne), **mode ambiant** (horloge plein écran) et **mode nuit**
- Architecture **Google Calendar** prête mais désactivée (`NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED=false`)

**V1.5** : Spotify Connect, actions contextuelles, minuteurs vocaux, « Pars maintenant » (Waze / Google Maps / Apple Plans), scènes personnalisables, liste de courses partagée — voir [V1.5](#v15--assistant-central-du-foyer).

Coût de fonctionnement : **0 €/mois** (Firebase Spark, Vercel Hobby, Ollama local, Open-Meteo, OSRM/Photon gratuits).

## Stack

| Couche | Choix |
|---|---|
| App | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 |
| Données | Firebase Auth + Firestore (source de vérité, cache hors ligne IndexedDB) |
| LLM | Ollama local (`qwen3:4b-instruct`) |
| Voix | Web Speech API (STT) · SpeechSynthesis (TTS) |
| Météo | Open-Meteo |
| Géocodage | Photon (komoot) → repli Nominatim |
| Itinéraires | OSRM (routing.openstreetmap.de : voiture, vélo, piéton) |
| Hébergement | Vercel (déploiement automatique depuis GitHub) |

## Architecture

```
src/
  app/                 pages (/, /settings), manifest, routes API (geocode, route, llm proxy, spotify)
  assistant/           tools (définitions), executor (seul point d'écriture), moduleTools, fastpaths, agent, hints, prompt
  components/          UI : calendrier, assistant, réglages, auth, primitives
    music/ timers/ shopping/ scenes/ navigation/   modules V1.5
  hooks/               useNow, useIdle, useOccurrences, useWeather, useTravel, useNextDeparture…
  lib/                 logique pure : dates, récurrence, conflits, disponibilités, départ, quick add, profils
    timers.ts shopping.ts commands.ts contextual.ts navigation.ts            (V1.5)
    server/            firebaseAuth.ts (vérif. jeton Firebase) · tokenVault.ts (chiffrement) · spotify.ts · llmAccess.ts
  providers/
    music/             MusicProvider → SpotifyProvider (Deezer / Apple Music / YouTube Music possibles)
    calendar/          CalendarProvider → LocalCalendarProvider (actif) · GoogleCalendarProvider (inactif) · Memory
    llm/               LLMProvider → OllamaProvider · OpenAIProvider / AnthropicProvider (prévus)
    speech/ tts/       SpeechProvider · TTSProvider (Web Speech)
    weather/           WeatherProvider → OpenMeteoProvider
    geocoding/         GeocodingProvider → Photon / Nominatim
    routing/           RoutingProvider → OSRM
tests/                 Vitest (dates, récurrence, conflits, disponibilités, trajets, quick add, tool calls, parsing Ollama)
firestore.rules        règles de sécurité (accès limité aux membres du foyer)
```

Le LLM **n'écrit jamais dans Firestore** : il appelle des outils (`createEvent`, `moveEvent`, `findAvailability`, `getWeather`, `calculateRoute`…) exécutés et validés par `ToolExecutor`. Chaque action est annulable.

Pour fiabiliser un petit modèle local : les dates (« jeudi », « demain soir ») sont pré-résolues par le code, les commandes simples « Ajoute … » passent par le parseur déterministe (instantané, sans LLM), et un garde-fou relance le modèle s'il annonce une action sans l'avoir exécutée.

### Modèle de données Firestore

```
users/{uid}                      householdId, profileId
households/{hid}                 name, ownerUid, memberUids[], homePlaceId, inviteCode, settings
households/{hid}/profiles/{id}   PERSON | COUPLE | GROUP | HOUSEHOLD
households/{hid}/events/{id}     title, start, end (ISO), allDay, profileIds, location, recurrence, reminders, travel, source
households/{hid}/places/{id}     lieux favoris (coordonnées)
households/{hid}/reminders/{id}
households/{hid}/assistantHistory/{id}
households/{hid}/timers/{id}         label, duration, expiresAt, status        (V1.5)
households/{hid}/shoppingItems/{id}  name, quantity, checked, createdBy        (V1.5)
households/{hid}/scenes/{id}         name, icon, widgets[], playlist, schedule (V1.5)
users/{uid}.spotify                  cipher (jeton chiffré, illisible côté client), name, product
invites/{code}                   → householdId
```

## Démarrage

Prérequis : Node.js ≥ 20.9, [Ollama](https://ollama.com) pour l'assistant.

```bash
npm install
cp .env.example .env.local     # puis compléter (Firebase…)
ollama pull qwen3:4b-instruct
npm run dev                    # http://localhost:3000
```

| Script | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build et serveur de production |
| `npm run lint` | ESLint |
| `npm test` | tests unitaires (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run icons` | régénère les icônes PWA depuis `public/icons/icon.svg` |

Test réel de l'assistant contre Ollama (désactivé par défaut) :

```powershell
$env:OLLAMA_IT="1"; npx vitest run tests/ollama.integration.test.ts
```

### Firebase

```bash
firebase deploy --only firestore   # règles + index
firebase deploy --only auth        # fournisseurs e-mail/mot de passe + Google
```

## Assistant local : modes de connexion

| Mode | Chemin | Usage |
|---|---|---|
| `proxy` | navigateur → `/api/llm/chat` → `OLLAMA_BASE_URL` | app lancée sur le PC qui exécute Ollama (`npm run dev` / `npm start`) |
| `direct` | navigateur → `http://localhost:11434` | version Vercel ouverte sur le PC qui exécute Ollama |
| `auto` (défaut) | proxy, sinon direct | — |

Pour le mode direct, Ollama doit autoriser l'origine du site :

```powershell
setx OLLAMA_ORIGINS "http://localhost:3000,https://*.vercel.app"
# puis redémarrer Ollama
```

Optimisation GPU 4 Go recommandée : `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`.

### PC de référence (tous les appareils)

En production, `/api/llm` passe par un **tunnel Tailscale Funnel** vers un seul PC qui exécute Ollama (`OLLAMA_TUNNEL_URL` + `OLLAMA_TUNNEL_TOKEN`), réservé aux membres connectés du foyer. Installation, changement de PC et dépannage : [`ollama-host/README.md`](ollama-host/README.md).

## V1.5 — assistant central du foyer

Le calendrier reste la colonne vertébrale ; les modules s'ajoutent sans le surcharger.

- **Mobile** : barre du bas *Aujourd'hui · Calendrier · + · Musique · Plus*.
- **Tablette / PC** : barre d'outils compacte (🎵 ⏱ 🛒 ✨) à côté de l'ajout rapide, panneaux ancrés à droite sur grand écran.

### Spotify Connect

HomeCal est une **télécommande Spotify** : la lecture se fait sur vos appareils Spotify (téléphone, ordinateur, enceinte connectée), HomeCal affiche ce qui joue et la pilote — mini-player, vue Musique (lecture, volume, appareils, playlists, récents, recherche, « Ouvrir Spotify »), affichage dans le mode ambiant et les scènes.

- **Spotify Premium** est requis pour contrôler la lecture (exigence de l'API Spotify).
- Sur iPhone, HomeCal ne joue pas la musique lui-même : il pilote un appareil Spotify.

**Sécurité des jetons** : le *client secret* reste sur Vercel. Après le consentement, le *refresh token* est **chiffré côté serveur** (AES-256-GCM, clé `HOMECAL_TOKEN_KEY`, lié à l'uid Firebase) et stocké sous forme de blob illisible dans `users/{uid}.spotify`. Toutes les commandes passent par `/api/spotify`, qui vérifie le jeton Firebase de l'utilisateur, déchiffre et n'autorise qu'une liste fermée d'opérations. Une seule connexion suffit pour tous les appareils de l'utilisateur.

**Créer l'application Spotify** (une fois) :

1. https://developer.spotify.com/dashboard → **Create app**.
2. *Redirect URI* : exactement `https://homecal.vercel.app/api/spotify/callback`.
3. Cocher **Web API**, enregistrer.
4. Copier le **Client ID** et le **Client Secret** (*Settings*).
5. *User Management* : ajouter l'e-mail Spotify de chaque membre du foyer (les applications en mode développement sont limitées aux utilisateurs autorisés).

**Variables Vercel** :

| Variable | Valeur |
|---|---|
| `SPOTIFY_CLIENT_ID` | Client ID |
| `SPOTIFY_CLIENT_SECRET` | Client Secret (*sensitive*) |
| `SPOTIFY_REDIRECT_URI` | `https://homecal.vercel.app/api/spotify/callback` |
| `HOMECAL_TOKEN_KEY` | 32 octets aléatoires en base64 (*sensitive*) — ne pas changer sans reconnecter Spotify |
| `NEXT_PUBLIC_SPOTIFY_ENABLED` | `true` |

```powershell
# générer HOMECAL_TOKEN_KEY
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

### Actions contextuelles

2 à 4 boutons choisis par des **règles déterministes** (sans LLM) selon l'heure, le prochain rendez-vous, le trajet, les profils sélectionnés, la musique, les minuteurs et les courses : *Ma journée*, *Itinéraire*, *Me rappeler*, *Trouver un créneau*, *Minuteur*, *Courses*, *Demain*, *Relax*, scène suggérée…

### Minuteurs

Plusieurs minuteurs simultanés, partagés dans le foyer. `expiresAt` est la source de vérité (pas de `setInterval`) : un minuteur survit à un rechargement, un changement de page ou un écran verrouillé. Pause, reprise, +1 min, annulation ; à l'échéance : alarme plein écran, sonnerie, voix, notification, *+5 min*.

> « Minuteur 12 minutes pour les pâtes » · « Réveille-moi dans 20 minutes » · « Dans 45 minutes rappelle-moi de sortir le linge » · « Annule le minuteur des pâtes »

### « Pars maintenant »

Pastille de départ 🟢 *Départ conseillé dans 24 min* → 🟠 *Pars dans 5 min* → 🔴 *Il est temps de partir* → ⚠️ *Tu devrais déjà être parti depuis 7 min*. Un appui ouvre l'itinéraire dans **Waze**, **Google Maps** ou **Apple Plans** (liens profonds, coordonnées GPS en priorité). Application préférée : *Réglages → Trajets* (ou « Demander à chaque fois »).

### Scènes

Entièrement personnalisables : **créer, modifier, supprimer**. Matin, Cuisine et Soir sont créées par défaut comme modèles. Chaque scène définit :

- les **éléments affichés** et leur ordre : heure, météo, programme du jour, prochain départ, musique, minuteurs, courses, demain, conflits ;
- une **playlist** (lancement automatique optionnel) ;
- une **activation automatique** sur une plage horaire (tablette / écran mural uniquement, jamais sur téléphone) ;
- **luminosité réduite** et **grands boutons** (mains occupées).

La scène active est propre à chaque appareil. Activation au toucher (*Scènes*) ou à la voix : « Mode cuisine », « Passe en mode soirée », « Quitte le mode ».

### Liste de courses partagée

Stockée dans `households/{hid}/shoppingItems`, synchronisée entre les membres, utilisable hors ligne. Cocher, masquer les articles achetés, vider, annuler.

> « Ajoute du lait et six œufs aux courses » · « Enlève le café de la liste » · « Qu'est-ce qu'il reste à acheter ? »

### Assistant

Nouveaux outils typés (toujours via `ToolExecutor`, jamais d'écriture directe du LLM) : `createTimer`, `listTimers`, `cancelTimer`, `pauseTimer`, `resumeTimer`, `addTimeToTimer` · `addShoppingItem`, `removeShoppingItem`, `completeShoppingItem`, `uncompleteShoppingItem`, `getShoppingList`, `clearCompletedShoppingItems` · `playMusic`, `playPlaylist`, `pauseMusic`, `resumeMusic`, `nextTrack`, `previousTrack`, `setMusicVolume`, `changeMusicDevice`, `searchMusic`, `getCurrentTrack` · `activateScene`, `exitScene` · `getNextDeparture`, `openNavigation`.

Les commandes simples (minuteurs, courses, scènes, musique, départ) sont reconnues **sans le LLM** : réponse instantanée, même si Ollama est indisponible. Seuls les groupes d'outils pertinents sont envoyés au modèle pour garder un prompt court. Quand plusieurs playlists correspondent, HomeCal demande laquelle.

### Feature flags

`NEXT_PUBLIC_SPOTIFY_ENABLED`, `NEXT_PUBLIC_TIMERS_ENABLED`, `NEXT_PUBLIC_SHOPPING_ENABLED`, `NEXT_PUBLIC_SCENES_ENABLED` (vrais par défaut) : une fonction peut être masquée sans supprimer son code.

## V2 — assistant « deterministic first, LLM second »

```
INPUT → normalisation → routeur d'intentions (score de confiance)
          ├─ confiance suffisante → outil → réponse déterministe   (0 appel LLM)
          └─ sinon                → LLM (outils du domaine, historique court, ≤ 3 étapes)
```

- **`src/assistant/router/`** : `normalize.ts` (accents, apostrophes, fautes STT, « euh / stp / tu peux », verbes canoniques), `intentRouter.ts` (seuils : ≥ 0,90 exécution, 0,70–0,90 si aucun concurrent proche, actions destructrices ≥ 0,95), `types.ts` (`ParsedIntent`, `PendingState`, `DomainModule`).
- **`src/assistant/parsers/`** : un module par domaine (courses, minuteurs, rappels, musique, scènes, navigation, météo, calendrier) = parseur + exécution + reprise d'une question (« À quelle heure ? », « Lequel ? »).
- **`src/assistant/responses/`** : réponses courtes construites depuis le `ToolResult` (« ✓ Lait et 6 œufs ajoutés aux courses. »).
- **LLM** : outils limités au domaine détecté, 0 à 4 tours d'historique selon le contexte, 3 étapes maximum, arrêt immédiat après une action réussie, et la réponse du modèle ne peut jamais contredire un outil réussi.
- **Ollama** : `num_ctx` 4096, `num_predict` 256, `keep_alive` 2 h, préchargement du modèle à l'ouverture de l'assistant.
- **Mesures** : chaque réponse porte `metrics` (`totalMs`, `routerMs`, `toolMs`, `llmMs`, `llmCalls`, `intent`, `confidence`). Affichage sous les réponses avec `NEXT_PUBLIC_ASSISTANT_DEBUG=true` ou `localStorage.setItem("homecal.debug","1")`.

| Benchmark (108 commandes simples) | Avant V2 | Après V2 |
|---|---|---|
| Traitées sans LLM | 52 % | **100 %** |
| Latence (hors réseau) | 10–140 s quand Ollama était appelé | p95 **1 ms** |

Tests : `tests/assistant-corpus/*` (≈ 1 100 formulations françaises : propres, familières, vocales, inversées, avec politesse), `tests/coverage.bench.test.ts`, `tests/latency.bench.test.ts`, `tests/assistant-quality.test.ts` (aucune contradiction, aucune action répétée).

## Raspberry Pi (kiosk)

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required https://<votre-app>.vercel.app
```

- Le mode ambiant s'active après inactivité (réglable), le mode nuit selon la plage horaire.
- La reconnaissance vocale Web Speech n'est pas disponible dans Chromium sur Raspberry Pi : l'ajout tactile, l'ajout rapide et l'assistant texte restent disponibles (un `SpeechProvider` local type Whisper pourra être branché sur la même interface).
- L'assistant LLM du Pi doit joindre un Ollama sur le réseau local (PC) : prévoir HTTPS ou servir HomeCal en local sur le réseau (contenu mixte http/https bloqué par les navigateurs).

## Google Calendar (préparé)

`GoogleCalendarProvider` implémente `connect / disconnect / listCalendars / getEvents / createEvent / updateEvent / deleteEvent / syncEvents` (API REST v3 + Google Identity Services). Tant que `NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED=false`, toutes les méthodes renvoient `NOT_CONFIGURED`.

Activation future : créer un client OAuth Web, activer l'API Google Calendar, renseigner `NEXT_PUBLIC_GOOGLE_CLIENT_ID` puis passer le flag à `true`.

## Sécurité

- `.env.local` est ignoré par Git ; aucun secret n'est écrit en dur.
- Les clés `NEXT_PUBLIC_FIREBASE_*` sont publiques par conception ; l'accès aux données est protégé par `firestore.rules` (membres du foyer uniquement).
- Secrets Spotify et clé de chiffrement uniquement côté serveur (Vercel) ; aucun refresh token en clair dans Firestore.
- Routes `/api/llm` et `/api/spotify` : jeton Firebase vérifié côté serveur avant toute action.
