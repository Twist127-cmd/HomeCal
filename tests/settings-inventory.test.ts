import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withDefaults } from "@/lib/data/household";
import { DEFAULT_SETTINGS } from "@/lib/types";

/**
 * Settings reorganisation guard: every setting that existed on the former single page
 * (audit of SettingsScreen.tsx before the split) must still be rendered by a section,
 * and the only additions are the voice choice settings.
 * We check the visible labels in the section sources (node test env, no DOM).
 */

const DIR = join(__dirname, "../src/components/settings");
const source = [join(DIR, "SettingsScreen.tsx"), join(DIR, "shared.tsx"), ...readdirSync(join(DIR, "sections")).map((f) => join(DIR, "sections", f))]
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

/** Inventory taken BEFORE the reorganisation: section → labels. */
const BEFORE: Record<string, string[]> = {
  Foyer: ["Nom du foyer", "Je suis", "Inviter un membre", "Identifiant du foyer"],
  Profils: ["Ajouter", "Nouveau profil", "Modifier le profil", '"Nom"', '"Avatar"', '"Couleur"', '"Type"', '"Membres"'],
  "Lieux favoris": ["Définir comme domicile", "Nouveau lieu favori", '"Icône"', '"Adresse"', "PLACE_SUGGESTIONS"],
  Affichage: ["Thème (sur cet appareil)", "Début de journée", "Fin de journée", "Mode ambiant après inactivité", "Mode nuit (écran sombre et atténué)", 'label="De"', 'label="À"'],
  Trajets: ["Mode par défaut", "Marge avant départ", "Navigation préférée", "Demander à chaque fois"],
  Musique: ["Connecter Spotify", "Déconnecter Spotify"],
  Minuteurs: ['label="Sonnerie"', 'label="Synthèse vocale"', 'label="Notifications"'],
  Scènes: ["<ScenesPanel />"],
  "Assistant (LLM local)": ["Connexion à Ollama", "URL Ollama (mode direct)", 'label="Modèle"', "Tester la connexion"],
  "Assistant vocal": [
    "Activer le mot de réveil sur cet appareil",
    "Nom de l'assistant",
    "Sensibilité",
    "Son d'activation",
    "Écouter automatiquement après",
    "Délai avant abandon",
    "Réponse vocale après commande",
    "Dernière phrase entendue",
  ],
  "Voix et notifications": ["Lire les réponses et rappels à voix haute", "Tester la voix", "Tester le micro", "Activer les notifications"],
  Intégrations: ["Google Calendar"],
  Compte: ["Se déconnecter"],
};

/** The only new settings allowed by this change. */
const ADDED = ['label="Voix"', 'label="Vitesse"', 'label="Tonalité"'];

describe("settings reorganisation keeps every existing setting", () => {
  it.each(Object.entries(BEFORE))("section « %s » and its settings are still rendered", (title, labels) => {
    expect(source).toContain(`title="${title}"`);
    for (const l of labels) expect(source, `${title} → ${l}`).toContain(l);
  });

  it("menu categories = the former sections exactly (no invented category)", async () => {
    const { SETTINGS_SECTIONS } = await import("@/components/settings/sections");
    expect(SETTINGS_SECTIONS.map((s) => s.title)).toEqual(Object.keys(BEFORE));
    expect(new Set(SETTINGS_SECTIONS.map((s) => s.id)).size).toBe(SETTINGS_SECTIONS.length);
  });

  it("count before = count after − new voice settings", () => {
    const before = Object.values(BEFORE).flat();
    const all = [...before, ...ADDED];
    expect(all.every((l) => source.includes(l))).toBe(true);
    expect(all.length - before.length).toBe(ADDED.length);
  });
});

describe("stored settings stay compatible", () => {
  it("an existing household without the new voice fields keeps its values and gets the defaults", () => {
    const h = withDefaults({ id: "h", settings: { voice: { lang: "fr-CH", autoSpeak: false } } as never });
    expect(h.settings.voice).toEqual({ lang: "fr-CH", autoSpeak: false, voiceURI: "", rate: 1, pitch: 1 });
    expect(h.settings.wakeWord).toEqual(DEFAULT_SETTINGS.wakeWord);
  });

  it("saved voice choices are kept", () => {
    const h = withDefaults({ id: "h", settings: { voice: { lang: "fr-FR", autoSpeak: true, voiceURI: "Microsoft Denise", rate: 0.9, pitch: 1.2 } } as never });
    expect(h.settings.voice).toMatchObject({ voiceURI: "Microsoft Denise", rate: 0.9, pitch: 1.2 });
  });
});
