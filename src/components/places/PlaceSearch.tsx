"use client";

import { MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { inputClass, Spinner } from "@/components/ui/primitives";
import type { GeocodeResult } from "@/providers/geocoding/GeocodingProvider";

/** Address autocomplete (Photon / Nominatim through /api/geocode). */
export function PlaceSearch({
  initial = "",
  placeholder = "Rechercher une adresse…",
  onPick,
  autoFocus,
}: {
  initial?: string;
  placeholder?: string;
  onPick(r: GeocodeResult): void;
  autoFocus?: boolean;
}) {
  const { geocoding, homePlace } = useApp();
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (picked || q.trim().length < 3) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await geocoding.search(q, homePlace ? { lat: homePlace.lat, lng: homePlace.lng } : undefined);
        if (!cancelled) setResults(r);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, picked, geocoding, homePlace]);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input
          className={`${inputClass} pl-11`}
          value={q}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setPicked(false);
            if (e.target.value.trim().length < 3) setResults([]);
          }}
        />
        {loading && (
          <span className="absolute top-1/2 right-4 -translate-y-1/2 text-muted">
            <Spinner size={16} />
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      {!picked && results.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-border bg-surface p-1 shadow-pop">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2"
                onClick={() => {
                  setPicked(true);
                  setQ(r.address || r.label);
                  setResults([]);
                  onPick(r);
                }}
              >
                <MapPin size={18} className="mt-0.5 shrink-0 text-muted" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.label}</span>
                  <span className="block truncate text-xs text-muted">{r.address}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
