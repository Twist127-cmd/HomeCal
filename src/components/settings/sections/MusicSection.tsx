"use client";

import { useMusic } from "@/components/music/MusicContext";
import { Button } from "@/components/ui/primitives";
import { Section } from "../shared";

export function MusicSection() {
  const music = useMusic();
  return (
    <Section title="Musique">
      {music.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">Spotify — Connecté{music.accountName ? ` : ${music.accountName}` : ""}</div>
            {music.premium === false && <div className="text-sm text-warn">Spotify Premium est nécessaire pour contrôler la lecture.</div>}
          </div>
          <Button variant="danger" size="sm" onClick={music.disconnect}>
            Déconnecter Spotify
          </Button>
        </div>
      ) : (
        <Button variant="primary" onClick={music.connect}>
          Connecter Spotify
        </Button>
      )}
      <p className="text-xs text-muted">Les playlists de chaque scène (Matin, Cuisine, Soir…) se choisissent dans la section Scènes.</p>
    </Section>
  );
}
