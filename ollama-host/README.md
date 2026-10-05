# PC de référence Ollama (assistant HomeCal)

L'assistant de HomeCal utilise **un seul PC** qui fait tourner Ollama. Tous les appareils (PC, téléphones, tablette, Raspberry Pi) y accèdent via HomeCal en ligne :

```
Appareil ──HTTPS──▶ homecal.vercel.app ──vérifie le compte HomeCal──▶
  https://homecal-ollama.tailc0b8c2.ts.net (Tailscale Funnel) ──▶ relais local :11435 (clé secrète) ──▶ Ollama :11434
```

- L'adresse du tunnel est **fixe** : elle suit la machine qui porte le nom Tailscale `homecal-ollama`.
- Vercel stocke l'adresse (`OLLAMA_TUNNEL_URL`) et la clé secrète (`OLLAMA_TUNNEL_TOKEN`).
- Le relais n'accepte que `POST /api/chat` et `GET /api/tags`, avec la clé.
- Le PC de référence doit rester **allumé** (pas de mise en veille) pour que l'assistant réponde.

Fichiers :

| Fichier | Rôle |
|---|---|
| `relay.mjs` | relais (Node.js, sans dépendance) |
| `setup.ps1` | installe le modèle, le relais (démarrage automatique) et le tunnel |
| `%LOCALAPPDATA%\HomeCal-Relay\relay.env` | clé secrète du PC (jamais dans Git) |
| `%LOCALAPPDATA%\HomeCal-Relay\relay.log` | journal du relais |

---

## Changer de PC de référence

### 1. Sur l'ancien PC (s'il est encore disponible)

1. Récupérer la clé secrète : ouvrir `%LOCALAPPDATA%\HomeCal-Relay\relay.env` et copier la valeur de `HOMECAL_RELAY_TOKEN`.
   (Si l'ancien PC n'est plus disponible : passer, une nouvelle clé sera générée à l'étape 3.)
2. Arrêter le tunnel et libérer le nom :
   ```powershell
   & "C:\Program Files\Tailscale\tailscale.exe" funnel --https=443 off
   & "C:\Program Files\Tailscale\tailscale.exe" logout
   ```
3. Supprimer le démarrage automatique du relais : effacer `HomeCal-Relay.vbs` dans le dossier Démarrage (`Win+R` → `shell:startup`).

### 2. Sur la console Tailscale

Ouvrir https://login.tailscale.com/admin/machines et **supprimer l'ancienne machine `homecal-ollama`** si elle apparaît encore (sinon le nouveau PC s'appellerait `homecal-ollama-1` et l'adresse changerait).

### 3. Sur le nouveau PC

1. Installer les outils :
   ```powershell
   winget install OpenJS.NodeJS.LTS
   winget install Ollama.Ollama
   winget install Tailscale.Tailscale
   ```
2. Se connecter à Tailscale avec **le même compte** et prendre le nom fixe :
   ```powershell
   & "C:\Program Files\Tailscale\tailscale.exe" login --hostname homecal-ollama
   ```
3. Récupérer le dossier `ollama-host` (clé USB, ou `git clone https://github.com/Twist127-cmd/HomeCal`) puis lancer :
   ```powershell
   cd <chemin>\ollama-host
   powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Token "<clé de l'étape 1>"
   ```
   Sans `-Token`, le script génère une nouvelle clé : il faut alors la mettre à jour sur Vercel (voir « Nouvelle clé » ci-dessous).
4. Vérifier que le script affiche **`https://homecal-ollama.tailc0b8c2.ts.net`**.
5. Redémarrer Ollama (icône près de l'horloge → Quit, puis relancer).
6. Désactiver la mise en veille : Paramètres → Système → Alimentation → Veille : **Jamais**.
7. Tester : HomeCal → Réglages → Assistant → **Tester la connexion** → « Connecté (proxy) ».

### Nouvelle clé (seulement si l'ancienne est perdue)

```powershell
cd C:\DEV\HomeCal
vercel env add OLLAMA_TUNNEL_TOKEN production --value "<nouvelle clé>" --sensitive --force
vercel env add OLLAMA_TUNNEL_TOKEN preview --value "<nouvelle clé>" --sensitive --force
vercel deploy --prod
```

Si l'adresse affichée est différente (autre compte Tailscale, nom déjà pris), mettre à jour `OLLAMA_TUNNEL_URL` de la même façon.

---

## Dépannage

| Symptôme | Vérification |
|---|---|
| « Le PC Ollama est éteint ou injoignable » | PC allumé ? Ollama lancé ? `tailscale funnel status` affiche « Funnel on » ? |
| « Session invalide » / « Connexion requise » | se reconnecter à HomeCal |
| « Funnel is not enabled on your tailnet » | ouvrir le lien affiché et cliquer *Enable* (une seule fois par compte Tailscale) |
| Relais arrêté | relancer `HomeCal-Relay.vbs` dans `shell:startup`, voir `relay.log` |
| Réponses lentes | `ollama ps` : le modèle doit être majoritairement sur GPU |
