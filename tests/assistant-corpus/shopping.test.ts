import { describe, expect, it } from "vitest";
import { handleUtterance } from "@/assistant/agent";
import { route } from "@/assistant/router/intentRouter";
import type { RouterContext } from "@/assistant/router/types";
import { DEFAULT_SCENES, type Scene } from "@/lib/types";
import { places, profiles } from "../fixtures";
import { makeAssistant, NOW } from "../helpers/assistant";

const scenes: Scene[] = DEFAULT_SCENES.map((s, i) => ({ ...s, id: `s${i}` }));
const ctx: RouterContext = { now: NOW, profiles, places, scenes, currentProfileId: "clement" };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe");

/** [phrase, expected item names (lower, accent-insensitive), optional quantities] */
type AddCase = [string, string[], (string | undefined)[]?];

const ADD: AddCase[] = [
  ["Ajoute du lait aux courses", ["lait"]],
  ["Ajoute lait courses", ["lait"]],
  ["Mets du lait dans la liste", ["lait"]],
  ["Mets du lait sur la liste", ["lait"]],
  ["Rajoute du lait", ["lait"]],
  ["Rajoute du lait dans mes courses", ["lait"]],
  ["Note du lait pour les courses", ["lait"]],
  ["Il faut du lait", ["lait"]],
  ["Il nous faut du lait", ["lait"]],
  ["Pense à acheter du lait", ["lait"]],
  ["Pense à prendre du lait", ["lait"]],
  ["Mets-moi du lait dans les courses", ["lait"]],
  ["Ajoute-moi du lait à la liste", ["lait"]],
  ["Rajoute du pain", ["pain"]],
  ["Mets des œufs dans la liste", ["oeufs"]],
  ["Note des tomates", ["tomates"]],
  ["Il nous faut du beurre", ["beurre"]],
  ["Il me faut du café", ["cafe"]],
  ["Pense à acheter du PQ", ["pq"]],
  ["Ajoute 6 œufs", ["oeufs"], ["6"]],
  ["Mets 2 bouteilles de lait", ["lait"], ["2 bouteilles"]],
  ["Rajoute un kilo de pommes", ["pommes"], ["1 kilo"]],
  ["Prends aussi du fromage", ["fromage"]],
  ["Ajoute lait, pain, œufs et tomates", ["lait", "pain", "oeufs", "tomates"]],
  ["euh ajoute moi du lait dans les courses s'il te plaît", ["lait"]],
  // voice-like (no accents / punctuation)
  ["ajoute du lait aux courses stp", ["lait"]],
  ["ajoute lait pain oeufs aux courses", ["lait pain oeufs"]],
  ["rajoute des pates", ["pates"]],
  ["il faut du cafe", ["cafe"]],
  ["pense a acheter des yaourts", ["yaourts"]],
  ["mets des pommes de terre sur la liste", ["pommes de terre"]],
  ["ajoute du papier toilette", ["papier toilette"]],
  ["ajoute de la lessive", ["lessive"]],
  ["rajoute du liquide vaisselle aux courses", ["liquide vaisselle"]],
  ["on a besoin de pain", ["pain"]],
  ["j'ai besoin de beurre", ["beurre"]],
  ["on n'a plus de lait", ["lait"]],
  ["il n'y a plus de café", ["cafe"]],
  ["il y a plus de sucre", ["sucre"]],
  ["achète du jambon", ["jambon"]],
  ["achete des bananes", ["bananes"]],
  ["n'oublie pas d'acheter du sel", ["sel"]],
  ["tu peux ajouter du lait aux courses", ["lait"]],
  ["est-ce que tu peux rajouter des œufs à la liste", ["oeufs"]],
  ["je voudrais que tu ajoutes du pain aux courses", ["pain"]],
  ["merci d'ajouter du beurre aux courses", ["beurre"]],
  ["ajoute aux courses du lait", ["lait"]],
  ["ajoute à la liste des tomates et des oignons", ["tomates", "oignons"]],
  ["sur la liste mets du riz", ["riz"]],
  ["courses : lait, pain", ["lait", "pain"]],
  ["liste de courses : farine et sucre", ["farine", "sucre"]],
  ["du lait aux courses", ["lait"]],
  ["des œufs sur la liste", ["oeufs"]],
  ["ajoute 3 boîtes de thon", ["thon"], ["3 boîtes"]],
  ["ajoute deux paquets de pâtes", ["pâtes"], ["2 paquets"]],
  ["ajoute 1 kg de carottes", ["carottes"], ["1 kg"]],
  ["mets une bouteille de vin aux courses", ["vin"], ["1 bouteille"]],
  ["rajoute douze œufs", ["oeufs"], ["12"]],
  ["ajoute 500 g de viande hachée aux courses", ["viande hachée"], ["500 g"]],
  ["note du shampoing", ["shampoing"]],
  ["note du dentifrice aux courses", ["dentifrice"]],
  ["ajoute des croquettes pour le chat aux courses", ["croquettes pour le chat"]],
  ["mets des sacs poubelle", ["sacs poubelle"]],
  ["ajoute du nutella", ["nutella"]],
  ["ajoute des chips et du coca", ["chips", "coca"]],
  ["rajoute aussi du fromage râpé", ["fromage râpé"]],
  ["ajoute aussi de la crème fraîche", ["crème fraîche"]],
  ["prends du pain", ["pain"]],
  ["prévois du lait", ["lait"]],
  ["AJOUTE DU LAIT AUX COURSES", ["lait"]],
  ["Ajoute du lait aux courses !", ["lait"]],
  ["ajoute    du   lait   aux   courses", ["lait"]],
  ["Ajoute du lait aux commissions", ["lait"]],
  ["mets des citrons dans mes courses", ["citrons"]],
  ["ajoute des fraises au caddie", ["fraises"]],
  ["il faut racheter du café", ["cafe"]],
  ["il faut acheter des piles", ["piles"]],
  ["pense à racheter des éponges", ["éponges"]],
  ["hop ajoute du lait aux courses", ["lait"]],
  ["et ajoute du pain aux courses", ["pain"]],
  ["euh rajoute des œufs", ["oeufs"]],
  ["heu il nous faut du beurre", ["beurre"]],
  ["ok homecal ajoute des tomates aux courses", ["tomates"]],
  ["Ajoute de l'huile d'olive aux courses", ["huile d'olive"]],
  ["Ajoute de la farine, du sucre et des œufs aux courses", ["farine", "sucre", "oeufs"]],
  ["Mets du jus d'orange sur la liste", ["jus d'orange"]],
  ["Note des mouchoirs", ["mouchoirs"]],
  ["Ajoute du gel douche", ["gel douche"]],
  ["Ajoute du déodorant aux courses", ["déodorant"]],
  ["il me faut de l'ail", ["ail"]],
  ["rajoute des carottes et des poireaux", ["carottes", "poireaux"]],
  ["ajoute du poulet pour ce soir aux courses", ["poulet pour ce soir"]],
];

const REMOVE: [string, string[]][] = [
  ["Enlève le lait", ["lait"]],
  ["Retire les tomates", ["tomates"]],
  ["Supprime le pain des courses", ["pain"]],
  ["Finalement pas besoin de café", ["cafe"]],
  ["enleve le lait de la liste", ["lait"]],
  ["retire les œufs des courses", ["oeufs"]],
  ["supprime le beurre de la liste de courses", ["beurre"]],
  ["efface le fromage de la liste", ["fromage"]],
  ["oublie le café", ["cafe"]],
  ["plus besoin de pain", ["pain"]],
  ["pas besoin de lait finalement", ["lait finalement"]],
  ["en fait pas besoin de beurre", ["beurre"]],
  ["on a déjà du sucre", ["sucre"]],
  ["j'ai déjà des œufs", ["oeufs"]],
  ["enlève les pommes et les poires", ["pommes", "poires"]],
  ["raye le jambon de la liste", ["jambon"]],
  ["vire les chips des courses", ["chips"]],
  ["tu peux enlever le lait de la liste", ["lait"]],
  ["retire le PQ", ["pq"]],
  ["supprime la lessive des courses", ["lessive"]],
];

const COMPLETE: [string, string[]][] = [
  ["J'ai pris le lait", ["lait"]],
  ["Coche les œufs", ["oeufs"]],
  ["Le pain c'est bon", ["pain"]],
  ["J'ai acheté les tomates", ["tomates"]],
  ["Marque le lait comme acheté", ["lait"]],
  ["j'ai pris le pain et le beurre", ["pain", "beurre"]],
  ["coche le café", ["cafe"]],
  ["on a pris les yaourts", ["yaourts"]],
  ["les œufs c'est pris", ["oeufs"]],
  ["le lait c'est fait", ["lait"]],
  ["j'ai trouvé le fromage", ["fromage"]],
  ["coche le lait sur la liste", ["lait"]],
  ["marque les pommes comme achetées", ["pommes"]],
  ["c'est bon pour le pain", ["pain"]],
  ["le beurre est pris", ["beurre"]],
  ["valide les tomates", ["tomates"]],
  ["j'ai acheté le PQ", ["pq"]],
  ["coche lait et pain", ["lait", "pain"]],
];

const UNCOMPLETE: [string, string[]][] = [
  ["Décoche le lait", ["lait"]],
  ["décoche les œufs", ["oeufs"]],
  ["remets le pain sur la liste", ["pain"]],
  ["en fait j'ai pas pris le beurre", ["beurre"]],
  ["je n'ai pas pris le café", ["cafe"]],
];

const LIST: string[] = [
  "Qu'est-ce qu'il reste aux courses ?",
  "Il reste quoi ?",
  "Lis-moi la liste",
  "Qu'est-ce qu'on doit acheter ?",
  "Montre les courses",
  "qu'est-ce qu'il reste à acheter",
  "il reste quoi à acheter",
  "qu'est ce qu'il faut acheter",
  "on doit acheter quoi",
  "affiche la liste de courses",
  "montre-moi la liste",
  "lis la liste de courses",
  "c'est quoi la liste de courses",
  "qu'y a-t-il sur la liste",
  "qu'est-ce qu'il y a sur la liste",
  "la liste de courses",
  "mes courses",
  "il faut acheter quoi",
  "qu'est-ce qu'il nous reste à acheter",
  "dis-moi la liste des courses",
];

const CLEAR: string[] = ["Efface les articles cochés", "vide les articles achetés", "supprime les articles cochés de la liste", "enlève ce qui est déjà pris", "nettoie les cochés"];

/** Must NOT be routed to the shopping domain. */
const NOT_SHOPPING: string[] = [
  "Ajoute dentiste jeudi à 16h",
  "Mets CrossFit demain à 18h30",
  "Note congé vendredi toute la journée",
  "Mets 10 minutes pour le four",
  "Mets Daft Punk",
  "Mets de la musique",
  "Mets ma playlist cuisine",
  "Mets le CrossFit à 19h",
  "Supprime le dentiste",
  "Enlève le minuteur",
  "Il faut que je parte à 8h",
  "Il reste combien de temps sur le minuteur ?",
  "Combien de temps reste-t-il ?",
  "Faire les courses samedi à 10h",
  "Ajoute réunion lundi de 9h à 10h",
  "Mets le son à 30 %",
  "Lance Spotify",
  "Rappelle-moi d'appeler maman à 18h",
  "J'ai pris rendez-vous chez le dentiste",
  "Mode cuisine",
  "Prends rendez-vous chez le coiffeur",
  "Mets Instant Crush",
  "Ajoute un rappel demain à 9h",
  "liste les minuteurs",
  "liste mes rappels",
  "liste des scènes",
  "quels sont mes rappels",
  "quels sont mes minuteurs",
  "quelles sont les scènes",
  "quels sont les modes",
  "liste des chronos",
  "affiche la liste des rappels",
];

describe("shopping corpus — music-like sentences stay low", () => {
  it.each(["Mets du Daft Punk", "Mets du rock", "Mets du jazz", "Mets de la pop"])("%s", (phrase) => {
    const shop = route(phrase, ctx).candidates.find((c) => c.module.domain === "shopping");
    expect(shop?.confidence ?? 0).toBeLessThanOrEqual(0.75);
  });
});

function shopping(phrase: string) {
  const d = route(phrase, ctx);
  return d;
}

const names = (e: Record<string, unknown>, key: "items" | "names") =>
  ((e[key] as ({ name: string } | string)[]) ?? []).map((x) => norm(typeof x === "string" ? x : x.name));

describe("shopping corpus — add", () => {
  it.each(ADD)("%s", (phrase, expected, quantities) => {
    const d = shopping(phrase);
    expect(d.best?.intent).toBe("shopping.add");
    expect(d.execute).toBe(true);
    expect(names(d.best!.entities, "items")).toEqual(expected.map(norm));
    if (quantities) expect((d.best!.entities.items as { quantity?: string }[]).map((i) => i.quantity)).toEqual(quantities);
  });
});

describe("shopping corpus — remove", () => {
  it.each(REMOVE)("%s", (phrase, expected) => {
    const d = shopping(phrase);
    expect(d.best?.intent).toBe("shopping.remove");
    expect(d.execute).toBe(true);
    expect(names(d.best!.entities, "names")).toEqual(expected.map(norm));
  });
});

describe("shopping corpus — complete / uncomplete", () => {
  it.each(COMPLETE)("%s", (phrase, expected) => {
    const d = shopping(phrase);
    expect(d.best?.intent).toBe("shopping.complete");
    expect(d.execute).toBe(true);
    expect(names(d.best!.entities, "names")).toEqual(expected.map(norm));
  });
  it.each(UNCOMPLETE)("%s", (phrase, expected) => {
    const d = shopping(phrase);
    expect(d.best?.intent).toBe("shopping.uncomplete");
    expect(d.execute).toBe(true);
    expect(names(d.best!.entities, "names")).toEqual(expected.map(norm));
  });
});

describe("shopping corpus — list / clear", () => {
  it.each(LIST)("%s", (phrase) => {
    const d = shopping(phrase);
    expect(d.best?.intent).toBe("shopping.list");
    expect(d.execute).toBe(true);
  });
  it.each(CLEAR)("%s", (phrase) => {
    const d = shopping(phrase);
    expect(d.best?.intent).toBe("shopping.clearCompleted");
    expect(d.execute).toBe(true);
  });
});

describe("shopping corpus — negatives (other domains)", () => {
  it.each(NOT_SHOPPING)("%s", (phrase) => {
    const d = shopping(phrase);
    const shop = d.candidates.find((c) => c.module.domain === "shopping");
    // either not parsed as shopping, or never the executed winner
    if (shop) expect(d.execute && d.best?.module.domain === "shopping").toBe(false);
  });
});

describe("shopping coverage", () => {
  it("≥ 95 % of shopping commands execute without LLM", () => {
    const all = [...ADD.map((a) => a[0]), ...REMOVE.map((r) => r[0]), ...COMPLETE.map((c) => c[0]), ...UNCOMPLETE.map((c) => c[0]), ...LIST, ...CLEAR];
    const ok = all.filter((p) => {
      const d = route(p, ctx);
      return d.execute && d.best?.module.domain === "shopping";
    });
    expect(all.length).toBeGreaterThanOrEqual(150);
    expect(ok.length / all.length).toBeGreaterThanOrEqual(0.95);
  });
});

describe("shopping end-to-end (no LLM)", () => {
  const BAD = /(pas compris|aucun|n'ai pas pu)/i;

  it("adds, answers briefly and never contradicts a successful tool", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "euh ajoute moi du lait et 6 œufs dans les courses s'il te plaît" });
    expect(a.shopping.map((i) => [i.name, i.quantity])).toEqual([
      ["Lait", undefined],
      ["Œufs", "6"],
    ]);
    expect(r.actions[0].result.ok).toBe(true);
    expect(r.text).toBe("✓ Lait et 6 œufs ajoutés aux courses.");
    expect(r.text).not.toMatch(BAD);
    expect(r.metrics?.llmCalls).toBe(0);
  });

  it("full flow: add, list, complete, remove, clear", async () => {
    const a = makeAssistant();
    const say = (input: string) => handleUtterance({ ...a.base, input });
    for (const p of ["Rajoute du pain", "Il nous faut du beurre", "Ajoute lait, pain, œufs et tomates"]) {
      const r = await say(p);
      expect(r.actions[0].result.ok).toBe(true);
      expect(r.text).not.toMatch(BAD);
    }
    expect(a.shopping.map((i) => i.name)).toEqual(["Pain", "Beurre", "Lait", "Œufs", "Tomates"]);
    expect((await say("Il reste quoi ?")).text).toBe("Il reste 5 articles : pain, beurre, lait, œufs et tomates.");
    const c = await say("J'ai pris le lait");
    expect(c.text).toBe("✓ Lait coché.");
    expect(a.shopping.find((i) => i.name === "Lait")?.checked).toBe(true);
    const rm = await say("Finalement pas besoin de beurre");
    expect(rm.text).toBe("✓ Beurre retiré de la liste.");
    expect(a.shopping.some((i) => i.name === "Beurre")).toBe(false);
    const cl = await say("Efface les articles cochés");
    expect(cl.actions[0].result.ok).toBe(true);
    expect(a.shopping.some((i) => i.name === "Lait")).toBe(false);
  });

  it("an item already on the list is not added twice and the answer says so", async () => {
    const a = makeAssistant();
    await handleUtterance({ ...a.base, input: "Ajoute du lait aux courses" });
    const r = await handleUtterance({ ...a.base, input: "Rajoute du lait" });
    expect(a.shopping).toHaveLength(1);
    expect(r.text).toMatch(/déjà sur la liste/);
  });

  it("removing an absent item gives a clear deterministic answer", async () => {
    const a = makeAssistant();
    const r = await handleUtterance({ ...a.base, input: "Enlève le lait" });
    expect(r.metrics?.llmCalls).toBe(0);
    expect(r.text).toMatch(/n'est pas sur la liste/);
  });
});
