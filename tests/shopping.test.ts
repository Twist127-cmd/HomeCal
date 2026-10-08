import { describe, expect, it } from "vitest";
import { describeList, findItem, parseItem, parseShoppingCommand, splitItems } from "@/lib/shopping";
import type { ShoppingItem } from "@/lib/types";

const item = (name: string, checked = false, quantity?: string): ShoppingItem => ({ id: name, name, checked, quantity, createdAt: "2026-10-08T07:00:00Z" });

describe("parseItem / splitItems", () => {
  it("strips articles and reads quantities", () => {
    expect(parseItem("du lait")).toEqual({ name: "Lait", quantity: undefined });
    expect(parseItem("six œufs")).toEqual({ name: "Œufs", quantity: "6" });
    expect(parseItem("2 kg de pommes")).toEqual({ name: "Pommes", quantity: "2 kg" });
    expect(parseItem("de la farine")).toEqual({ name: "Farine", quantity: undefined });
  });

  it("splits lists", () => {
    expect(splitItems("des tomates, des œufs et du pain").map((i) => i.name)).toEqual(["Tomates", "Œufs", "Pain"]);
  });
});

describe("parseShoppingCommand", () => {
  it("adds items", () => {
    expect(parseShoppingCommand("Ajoute du lait aux courses")).toEqual({ op: "add", items: [{ name: "Lait", quantity: undefined }] });
    expect(parseShoppingCommand("Mets des tomates, des œufs et du pain sur la liste")?.op).toBe("add");
    const r = parseShoppingCommand("HomeCal, ajoute du lait et six œufs aux courses");
    expect(r).toEqual({ op: "add", items: [{ name: "Lait", quantity: undefined }, { name: "Œufs", quantity: "6" }] });
    expect(parseShoppingCommand("Ajoute à la liste de courses : beurre, café")?.op).toBe("add");
  });

  it("removes, checks and lists", () => {
    expect(parseShoppingCommand("Enlève le café de la liste")).toEqual({ op: "remove", names: ["Café"] });
    expect(parseShoppingCommand("Qu'est-ce qu'il reste à acheter dans les courses ?")).toEqual({ op: "list" });
    expect(parseShoppingCommand("Affiche la liste de courses")).toEqual({ op: "list" });
    expect(parseShoppingCommand("Efface les articles cochés de la liste")).toEqual({ op: "clearChecked" });
  });

  it("ignores calendar sentences", () => {
    expect(parseShoppingCommand("Ajoute dentiste jeudi à 16h")).toBeNull();
    expect(parseShoppingCommand("Faire les courses samedi à 10h")).toBeNull();
  });
});

describe("helpers", () => {
  it("finds items tolerantly (accents, plural)", () => {
    const list = [item("Tomates"), item("Café")];
    expect(findItem(list, "tomate")?.id).toBe("Tomates");
    expect(findItem(list, "cafe")?.id).toBe("Café");
  });

  it("describes the list for speech", () => {
    expect(describeList([item("Lait"), item("Œufs", false, "6"), item("Pain", true)])).toBe("Il reste 2 articles : lait et 6 œufs.");
    expect(describeList([])).toBe("La liste de courses est vide.");
  });
});
