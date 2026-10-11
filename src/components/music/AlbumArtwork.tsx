"use client";
import { useState } from "react";
import { Music2 } from "lucide-react";
export function AlbumArtwork({ src, className, size = 64 }: { src?: string; className?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Pochette du titre en cours" width={size} height={size} loading="lazy" onError={() => setFailed(true)} className={className} />
  ) : <span className={"inline-flex items-center justify-center bg-surface-2 " + (className ?? "")} aria-label="Pochette indisponible"><Music2 size={Math.min(size / 2, 80)} strokeWidth={1.5} /></span>;
}
