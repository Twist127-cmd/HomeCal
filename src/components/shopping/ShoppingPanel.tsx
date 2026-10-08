"use client";

import clsx from "clsx";
import { Check, Eye, EyeOff, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { updateSettings } from "@/lib/data/household";
import { firestore } from "@/lib/firebase/client";
import { useModuleStores } from "@/hooks/useModules";
import { findItem, splitItems } from "@/lib/shopping";
import { vibrate } from "@/lib/sound";
import type { ShoppingItem } from "@/lib/types";

/** Shared household shopping list — ultra fast to use. */
export function ShoppingPanel({ large }: { large?: boolean }) {
  const { shopping, household, householdId, myProfileId } = useApp();
  const stores = useModuleStores();
  const [text, setText] = useState("");
  const hideChecked = household?.settings.shopping.hideChecked ?? false;
  const todo = shopping.filter((i) => !i.checked);
  const done = shopping.filter((i) => i.checked).sort((a, b) => (b.checkedAt ?? "").localeCompare(a.checkedAt ?? ""));

  const add = () => {
    if (!stores) return;
    const items = splitItems(text);
    if (!items.length) return;
    const added: ShoppingItem[] = [];
    Promise.all(
      items
        .filter((p) => !findItem(todo, p.name))
        .map((p) =>
          stores.shopping.add({ name: p.name, quantity: p.quantity, checked: false, createdAt: new Date().toISOString(), createdBy: myProfileId }).then((it) => added.push(it)),
        ),
    ).then(() => {
      if (added.length)
        toast({
          text: `✓ ${added.map((a) => a.name).join(", ")} ajouté(s) aux courses`,
          tone: "success",
          action: { label: "Annuler", run: () => Promise.all(added.map((a) => stores.shopping.remove(a.id))).then(() => {}) },
        });
    });
    setText("");
  };

  const toggle = (it: ShoppingItem) => {
    vibrate(10);
    stores?.shopping.update(it.id, { checked: !it.checked, checkedAt: !it.checked ? new Date().toISOString() : undefined });
  };

  return (
    <div className="space-y-4 p-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ajouter (ex. lait, 6 œufs, pain)"
          className={clsx("min-w-0 flex-1 rounded-2xl border border-border bg-surface-2 px-4 outline-none focus:border-accent", large ? "h-16 text-xl" : "h-12")}
          enterKeyHint="done"
        />
        <Button type="submit" variant="primary" size={large ? "lg" : "md"} disabled={!text.trim()}>
          <Plus size={20} />
        </Button>
      </form>

      {todo.length === 0 && done.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted">
          <ShoppingCart size={36} />
          <p>La liste est vide.</p>
          <p className="text-sm">Dites « Ajoute du lait et des œufs aux courses ».</p>
        </div>
      )}

      <ul className="space-y-1">
        {todo.map((it) => (
          <Row key={it.id} it={it} onToggle={() => toggle(it)} onRemove={() => stores?.shopping.remove(it.id)} large={large} />
        ))}
      </ul>

      {done.length > 0 && (
        <section>
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-muted">Acheté ({done.length})</h4>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  householdId && household && updateSettings(firestore(), householdId, { ...household.settings, shopping: { hideChecked: !hideChecked } })
                }
                className="flex h-9 items-center gap-1 rounded-full px-3 text-sm text-muted hover:bg-surface-2"
              >
                {hideChecked ? <Eye size={15} /> : <EyeOff size={15} />} {hideChecked ? "Afficher" : "Masquer"}
              </button>
              <button
                onClick={() => {
                  const removed = [...done];
                  removed.forEach((i) => stores?.shopping.remove(i.id));
                  toast({ text: `${removed.length} article(s) retiré(s)`, action: { label: "Annuler", run: () => Promise.all(removed.map((i) => stores!.shopping.put(i))).then(() => {}) } });
                }}
                className="flex h-9 items-center gap-1 rounded-full px-3 text-sm text-danger hover:bg-danger/10"
              >
                <Trash2 size={15} /> Vider
              </button>
            </div>
          </div>
          {!hideChecked && (
            <ul className="space-y-1">
              {done.map((it) => (
                <Row key={it.id} it={it} onToggle={() => toggle(it)} onRemove={() => stores?.shopping.remove(it.id)} large={large} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Row({ it, onToggle, onRemove, large }: { it: ShoppingItem; onToggle(): void; onRemove(): void; large?: boolean }) {
  return (
    <li className="group flex animate-fade-in items-center gap-2">
      <button
        onClick={onToggle}
        className={clsx("flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 text-left transition hover:bg-surface-2 active:scale-[0.99]", large ? "h-16" : "h-12")}
      >
        <span
          className={clsx(
            "flex shrink-0 items-center justify-center rounded-lg border-2 transition",
            large ? "h-8 w-8" : "h-6 w-6",
            it.checked ? "border-ok bg-ok text-white" : "border-border",
          )}
        >
          {it.checked && <Check size={large ? 20 : 15} strokeWidth={3} />}
        </span>
        <span className={clsx("min-w-0 flex-1 truncate", large && "text-xl", it.checked && "text-muted line-through")}>
          {it.quantity && <span className="mr-1 font-semibold">{it.quantity}</span>}
          {it.name}
        </span>
      </button>
      <button onClick={onRemove} className="flex h-10 w-10 items-center justify-center rounded-full text-muted opacity-60 hover:bg-danger/10 hover:text-danger" aria-label="Supprimer">
        <Trash2 size={16} />
      </button>
    </li>
  );
}
