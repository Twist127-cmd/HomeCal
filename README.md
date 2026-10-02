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
  app/                 pages (/, /settings), manifest, routes API (geocode, route, llm proxy)
  assistant/           tools (définitions), executor (seul point d'écriture), agent (boucle tool-calling), hints, prompt
  components/          UI : calendrier, assistant, réglages, auth, primitives
  hooks/               useNow, useIdle, useOccurrences, useWeather, useTravel…
  lib/                 logique pure : dates, récurrence, conflits, disponibilités, départ, quick add, profils
  providers/
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
