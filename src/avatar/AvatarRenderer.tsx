"use client";
import { memo, useId, useMemo, type CSSProperties } from "react";
import { mix } from "@/theme/tokens";
import { useAvatarContext } from "./AvatarProvider";
import { composeAvatar } from "./AvatarContextEngine";
import { normalizeAvatar } from "./config";
import { isPet } from "./catalog";
import type { AvatarConfig, AvatarContext, AnimationLevel } from "./types";
const backgrounds: Record<string, string> = { neutral: "#dce0e5", warm: "#e8d6bc", sky: "#cbdde9", sage: "#d5dfce", rose: "#ead6df", night: "#263041" };
export const AvatarRenderer = memo(function AvatarRenderer({ config, size = 100, context: override, intensity: level, decorative = true, label = "Avatar", stage = false, delay = 0 }: { config: AvatarConfig; size?: number; context?: AvatarContext; intensity?: AnimationLevel; decorative?: boolean; label?: string; stage?: boolean; delay?: number }) {
  const shared = useAvatarContext(); const context = override ?? shared.context, intensity = level ?? shared.intensity;
  const c = useMemo(() => normalizeAvatar(config), [config]);
  const appearance = useMemo(() => composeAvatar(c, context, intensity), [c, context, intensity]);
  const uid = useId().replace(/:/g, "");
  const pet = isPet(c.type), color = pet ? c.pet.color : c.base.skinTone;
  const grad = (name: string) => `url(#${uid}-${name})`;
  const clothing = appearance.outfit === "kitchen" ? "#e9dfcb" : c.outfit.color;
  return <span className="avatar-renderer" data-type={c.type} data-breed={pet ? c.pet.breed : undefined} data-motion={appearance.animation} data-intensity={intensity} data-lighting={appearance.lighting} data-stage={stage} data-icon={size < 48} style={{ width: size, height: size, "--avatar-delay": -delay + "s", "--avatar-background": backgrounds[c.background] ?? "var(--color-accent-soft)", "--avatar-shade": color } as CSSProperties}>
    <svg viewBox={stage ? "0 0 240 320" : "20 20 200 235"} width="100%" height="100%" role={decorative ? undefined : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : label} focusable="false">
      <defs>
        <radialGradient id={uid + "-skin"} cx="32%" cy="27%" r="80%"><stop stopColor={mix(color, "#fff5df", .32)} /><stop offset=".55" stopColor={color} /><stop offset="1" stopColor={mix(color, "#35221d", .3)} /></radialGradient>
        <radialGradient id={uid + "-nose"} cx="30%" cy="18%"><stop stopColor={mix(color, "#ffffff", .22)} /><stop offset="1" stopColor={mix(color, "#593c31", .2)} /></radialGradient>
        <linearGradient id={uid + "-hair"} x2=".8" y2="1"><stop stopColor={mix(c.hair.color, "#ffffff", .22)} /><stop offset=".4" stopColor={c.hair.color} /><stop offset="1" stopColor={mix(c.hair.color, "#000000", .25)} /></linearGradient>
        <radialGradient id={uid + "-outfit"} cx="35%" cy="15%" r="95%"><stop stopColor={mix(clothing, "#ffffff", .22)} /><stop offset=".5" stopColor={clothing} /><stop offset="1" stopColor={mix(clothing, "#111923", .4)} /></radialGradient>
        <radialGradient id={uid + "-sheen"} cx="20%" cy="10%" r="85%"><stop stopColor="white" stopOpacity=".22" /><stop offset=".7" stopColor="white" stopOpacity="0" /></radialGradient>
        <radialGradient id={uid + "-shadow"}><stop stopColor="#111923" stopOpacity=".25" /><stop offset="1" stopColor="#111923" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="120" cy="303" rx="83" ry="12" fill={grad("shadow")} />
      <g className="avatar-body">
        {pet ? <Pet config={c} grad={grad} accessories={appearance.accessories} /> : <Human config={c} grad={grad} outfit={appearance.outfit} accessories={appearance.accessories} />}
      </g>
    </svg>
  </span>;
});
type DrawProps = { config: AvatarConfig; grad(name: string): string; accessories: string[] };
function Human({ config: c, grad, accessories: a, outfit }: DrawProps & { outfit: string }) {
  const baby = c.type === "baby", child = c.type === "child", teen = c.type === "teen";
  const cy = baby ? 139 : child ? 123 : teen ? 111 : 105;
  const ry = baby ? 64 : child ? 65 : c.base.faceShape === "long" ? 73 : c.base.faceShape === "round" ? 58 : 66;
  const rx = baby ? 67 : child ? 59 : c.base.faceShape === "round" || c.base.faceShape === "square" ? 61 : c.base.faceShape === "long" ? 50 : 55;
  const y = cy + ry - 6, width = (baby ? 40 : child ? 44 : 50) + (c.base.bodyType === "broad" ? 11 : c.base.bodyType === "slim" ? -7 : 0);
  const longHair = ["long", "medium", "braids", "locks", "ponytail"].includes(c.hair.style) || c.hair.length !== "short" && !["bald", "shaved"].includes(c.hair.style);
  const hairEnd = y + (c.hair.length === "long" || c.hair.style === "long" ? 65 : 25);
  return <>
    {(a.includes("bag") || a.includes("schoolbag")) && <rect x={120 + width - 10} y={y + 35} width="33" height="63" rx="14" fill={a.includes("schoolbag") ? "#bb795e" : "#776850"} />}
    {longHair && <path d={`M${120 - rx - 3} ${cy - 20} Q120 ${cy - ry - 35} ${120 + rx + 3} ${cy - 20} L${120 + rx + 8} ${hairEnd} Q120 ${hairEnd + 17} ${120 - rx - 8} ${hairEnd}Z`} fill={grad("hair")} />}
    <path d={`M${120 - width + 13} 280 L${120 - width + 12} 301 Q${120 - width + 40} 310 113 296 L114 270Z M${120 + width - 13} 280 L${120 + width - 12} 301 Q${120 + width - 40} 310 127 296 L126 270Z`} fill="#38404c" />
    <path d={`M${120 - width} ${y + 40} Q${120 - width - 15} ${y + 60} ${120 - width - 4} ${Math.min(286, y + 100)} Q${120 - width + 5} 298 ${120 - width + 12} 279 L${120 - width + 15} ${y + 42}Z M${120 + width} ${y + 40} Q${120 + width + 15} ${y + 60} ${120 + width + 4} ${Math.min(286, y + 100)} Q${120 + width - 5} 298 ${120 + width - 12} 279 L${120 + width - 15} ${y + 42}Z`} fill={grad("skin")} />
    <path d={`M${120 - width} ${y + 25} Q120 ${y - 10} ${120 + width} ${y + 25} L${120 + width - 5} 281 Q120 299 ${120 - width + 5} 281Z`} fill={grad("outfit")} />
    <rect x="108" y={y - 14} width="24" height="35" rx="12" fill={grad("skin")} />
    <path d={`M96 ${y + 17} Q120 ${y + 38} 144 ${y + 17}`} fill="none" stroke="#111923" strokeOpacity=".17" strokeWidth="5" />
    {outfit === "casual" && <><path d={`M102 ${y + 14}L120 ${y + 30} 109 ${y + 40} 91 ${y + 21}Z M138 ${y + 14}L120 ${y + 30} 131 ${y + 40} 149 ${y + 21}Z`} fill={mix(c.outfit.color, "#ffffff", .15)} /><path d={`M120 ${y + 30}V277`} stroke="#15222c" strokeOpacity=".18" strokeWidth="2" />{[0, 1, 2].map((i) => <circle key={i} cx="122" cy={y + 45 + i * 17} r="2" fill="#e5e7df" />)}</>}
    {(outfit === "tshirt" || outfit === "summer") && <path d={`M100 ${y + 15}Q120 ${y + (outfit === "summer" ? 48 : 39)} 140 ${y + 15}`} fill="none" stroke={mix(c.outfit.color, "#ffffff", .2)} strokeWidth={outfit === "summer" ? 4 : 7} />}
    {outfit === "home" && <><path d={`M91 ${y + 18}Q90 ${y - 7} 120 ${y - 1}Q150 ${y - 7} 149 ${y + 18}Q120 ${y + 42} 91 ${y + 18}`} fill={mix(c.outfit.color, "#111923", .12)} /><rect x="101" y={Math.min(258, y + 64)} width="38" height="18" rx="7" fill="#ffffff" fillOpacity=".1" /></>}
    {outfit === "sport" && <><path d={`M${120 - width + 8} ${y + 25}V278 M${120 + width - 8} ${y + 25}V278`} stroke="#faf5e8" strokeWidth="6" opacity=".8" /><text x="120" y={y + 74} fontSize="25" textAnchor="middle" fill="#faf5e8">7</text></>}
    {(outfit === "chic" || outfit === "work") && <><path d={`M101 ${y + 15} L120 ${y + 77} 139 ${y + 15}`} fill="#faf3e6" /><path d={`M116 ${y + 30}L124 ${y + 30} 128 ${y + 72} 120 ${y + 85} 112 ${y + 72}Z`} fill="#5d4f6a" /></>}
    {outfit === "chic" && <path d={`M99 ${y + 17}L83 ${y + 37} 112 ${y + 82}L108 ${y + 34}Z M141 ${y + 17}L157 ${y + 37} 128 ${y + 82}L132 ${y + 34}Z`} fill={mix(c.outfit.color, "#111923", .16)} />}
    {(outfit === "overalls" || outfit === "kitchen") && <><rect x="93" y={y + 31} width="54" height={Math.max(35, 267 - y - 31)} rx="10" fill={outfit === "kitchen" ? "#a5b7a6" : "#63839a"} /><path d={`M97 ${y + 15}V${y + 53} M143 ${y + 15}V${y + 53}`} stroke={outfit === "kitchen" ? "#a5b7a6" : "#63839a"} strokeWidth="9" /><path d={`M105 ${y + 58}H135V${y + 72}Q120 ${y + 84} 105 ${y + 72}Z`} fill="#fff9ee" opacity=".25" /></>}
    {outfit === "pajamas" && Array.from({ length: 6 }, (_, i) => <circle key={i} cx={100 + i % 3 * 20} cy={y + 40 + Math.floor(i / 3) * 25} r="3" fill="#fff9eb" opacity=".6" />)}
    {outfit === "winter" && <path d={`M${120 - width + 5} ${y + 32} Q120 ${y + 52} ${120 + width - 5} ${y + 32} M${120 - width + 5} ${y + 50}Q120 ${y + 70} ${120 + width - 5} ${y + 50}`} fill="none" stroke="#f7e4c7" strokeOpacity=".45" strokeWidth="5" />}
    {outfit === "sweatshirt" && <><path d={`M92 ${y + 17}Q120 ${y + 52} 148 ${y + 17}`} fill="none" stroke={c.outfit.color} strokeWidth="13" /><path d={`M109 ${y + 33}V${y + 53} M131 ${y + 33}V${y + 53}`} stroke="#eee5d9" strokeWidth="2" /></>}
    {outfit === "dress" && <path d={`M${120 - width + 8} ${y + 50}L${120 - width - 10} 288Q120 305 ${120 + width + 10} 288L${120 + width - 8} ${y + 50}Z`} fill={grad("outfit")} />}
    <g className="avatar-head">
      {c.hair.style === "bun" && <circle cx="125" cy={cy - ry - 6} r="25" fill={grad("hair")} />}
      {c.hair.style === "ponytail" && <path d={`M${120 + rx - 5} ${cy - 25}Q218 ${cy - 64} 196 ${cy + 88}Q170 ${cy + 98} 174 ${cy + 55}Q193 ${cy - 1} ${120 + rx - 5} ${cy - 25}`} fill={grad("hair")} />}
      {[1, -1].map((side) => <g key={side}><ellipse cx={120 + side * rx} cy={cy + 3} rx={c.face.ears === "small" ? 9 : c.face.ears === "prominent" ? 16 : 12} ry="19" fill={grad("skin")} /><ellipse cx={120 + side * (rx + 1)} cy={cy + 3} rx="5" ry="11" fill={mix(c.base.skinTone, "#944b49", .22)} /></g>)}
      <path d={`M${120 - rx} ${cy - 10}C${120 - rx} ${cy - ry - 13} ${120 + rx} ${cy - ry - 13} ${120 + rx} ${cy - 10}Q${120 + rx + 2} ${cy + ry - 13} ${c.base.faceShape === "square" ? 141 : 120} ${cy + ry} ${c.base.faceShape === "square" ? `L99 ${cy + ry}` : ""}Q${c.base.faceShape === "heart" ? 85 : 120 - rx - 2} ${cy + ry - (c.base.faceShape === "heart" ? 23 : 13)} ${120 - rx} ${cy - 10}Z`} fill={grad("skin")} />
      <ellipse cx="120" cy={cy - 4} rx={rx} ry={ry - 1} fill={grad("sheen")} />
      {c.face.cheeks === "rosy" && [1, -1].map((s) => <ellipse key={s} cx={120 + s * 31} cy={cy + 23} rx="14" ry="8" fill="#d77573" opacity=".28" />)}
      {c.face.cheeks === "freckles" && [1, -1].flatMap((s) => [0, 1, 2, 3].map((i) => <circle key={s + ":" + i} cx={120 + s * (25 + i * 5)} cy={cy + 15 + i % 2 * 4} r="1.4" fill={mix(c.base.skinTone, "#533726", .45)} />))}
      <Eyes x={120} y={cy + 1} color={c.face.eyeColor} shape={c.face.eyes} iris={c.face.iris} />
      {[-1, 1].map((s) => <path key={s} d={`M${120 + s * 20 - 12} ${cy - 17}Q${120 + s * 20} ${cy - (c.face.brows === "arched" ? 28 : c.face.brows === "straight" ? 17 : 23)} ${120 + s * 20 + 12} ${cy - 17}`} fill="none" stroke={c.hair.color} strokeWidth={c.face.brows === "thick" ? 6 : 4} strokeLinecap="round" />)}
      <ellipse cx="120" cy={cy + 22} rx={c.face.nose === "wide" ? 13 : c.face.nose === "straight" ? 7 : 9} ry={c.face.nose === "straight" ? 14 : 9} fill={grad("nose")} /><path d={`M115 ${cy + 29}Q120 ${cy + 33} 125 ${cy + 29}`} fill="none" stroke="#784533" strokeOpacity=".28" strokeWidth="2" />
      {c.face.beard !== "none" && <Beard kind={c.face.beard} cy={cy} rx={rx} color={grad("hair")} />}
      {c.face.mouth === "wide" ? <><path d={`M101 ${cy + 42}Q120 ${cy + 65} 139 ${cy + 42}Z`} fill="#693b36" /><path d={`M103 ${cy + 43}Q120 ${cy + 50} 137 ${cy + 43}L133 ${cy + 49}Q120 ${cy + 55} 107 ${cy + 49}Z`} fill="#fff7ea" /></> : <path d={`M106 ${cy + 44}Q120 ${cy + (c.face.mouth === "neutral" ? 45 : 55)} 134 ${cy + 44}`} fill="none" stroke="#794b43" strokeWidth="3" strokeLinecap="round" />}
      <Hair config={c} cy={cy} rx={rx} ry={ry} fill={grad("hair")} />
      <HeadAccessories accessories={a} cy={cy} rx={rx} top={cy - ry} />
    </g>
    <BodyAccessories accessories={a} y={y} width={width} />
  </>;
}
function Eyes({ x, y, color, shape, iris, pet = false }: { x: number; y: number; color: string; shape: string; iris?: string; pet?: boolean }) {
  return <g className="avatar-eyes">{[-1, 1].map((s) => <g key={s}><ellipse cx={x + s * 22} cy={y} rx={shape === "wide" ? 14 : 12} ry={shape === "round" ? 13 : 9} fill="#faf9f4" /><ellipse cx={x + s * 22} cy={y + 1} rx={iris === "large" ? 8 : iris === "small" ? 5 : 7} ry="8" fill={color} /><ellipse cx={x + s * 22} cy={y + 1} rx={pet ? 2.8 : 3.5} ry="5" fill="#151a20" /><circle cx={x + s * 22 - 2} cy={y - 2} r="2.2" fill="white" /><path d={`M${x + s * 22 - 12} ${y - 2}Q${x + s * 22} ${y - 15} ${x + s * 22 + 12} ${y - 2}`} fill="none" stroke="#3a2e2a" strokeOpacity=".6" strokeWidth="2" /></g>)}</g>;
}
function Beard({ kind, cy, rx, color }: { kind: string; cy: number; rx: number; color: string }) {
  return kind === "mustache" ? <path d={`M120 ${cy + 34}Q99 ${cy + 27} 97 ${cy + 43}Q110 ${cy + 46} 120 ${cy + 39}Q130 ${cy + 46} 143 ${cy + 43}Q141 ${cy + 27} 120 ${cy + 34}`} fill={color} /> : kind === "goatee" ? <ellipse cx="120" cy={cy + 58} rx="13" ry="12" fill={color} /> : kind === "sideburns" ? <><rect x={120 - rx} y={cy} width="10" height="28" rx="5" fill={color} /><rect x={120 + rx - 10} y={cy} width="10" height="28" rx="5" fill={color} /></> : <path d={`M${120 - rx + 4} ${cy + 18}Q${120 - rx + 13} ${cy + 42} 103 ${cy + 41}Q120 ${cy + 32} 137 ${cy + 41}Q${120 + rx - 13} ${cy + 42} ${120 + rx - 4} ${cy + 18}Q${120 + rx} ${cy + 62} 120 ${cy + (kind === "long" ? 88 : 66)}Q${120 - rx} ${cy + 62} ${120 - rx + 4} ${cy + 18}Z`} fill={color} opacity={kind === "short" ? .85 : 1} />;
}
function Hair({ config: c, cy, rx, ry, fill }: { config: AvatarConfig; cy: number; rx: number; ry: number; fill: string }) {
  const style = c.hair.style, top = cy - ry;
  if (style === "bald") return null;
  const volume = c.hair.volume === "full" ? 13 : c.hair.volume === "low" ? -3 : 4;
  const textured = ["curly", "coily", "wavy"].includes(style) || c.hair.texture !== "straight";
  if (style === "shaved" || style === "very-short") return <path d={`M${120 - rx} ${cy - 9}Q${120 - rx - 1} ${top - 8} 120 ${top - 9}Q${120 + rx + 1} ${top - 8} ${120 + rx} ${cy - 9}L${120 + rx - 8} ${cy - 20}Q120 ${top + 6} ${120 - rx + 8} ${cy - 20}Z`} fill={fill} opacity={style === "shaved" ? .45 : 1} />;
  return <g><path d={`M${120 - rx - 2} ${cy + 2}Q${120 - rx - 10} ${top - 21 - volume} 120 ${top - 13 - volume}Q${120 + rx + 8} ${top - 23 - volume} ${120 + rx + 2} ${cy + 2}L${120 + rx - 9} ${cy - 16}Q149 ${cy - 25} 143 ${top + 12}Q120 ${top + 35} ${120 - rx + 12} ${cy - 20}L${120 - rx + 8} ${cy + 2}Z`} fill={fill} />
    {textured && Array.from({ length: style === "coily" || c.hair.texture === "coily" ? 16 : 9 }, (_, i) => <ellipse key={i} cx={120 - rx + 5 + i * (rx * 2 - 10) / (style === "coily" || c.hair.texture === "coily" ? 15 : 8)} cy={top + 7 + Math.sin(i) * 7} rx={style === "coily" ? 10 : 13} ry={style === "wavy" || c.hair.texture === "wavy" ? 10 : 17} fill={fill} />)}
    {["braids", "locks"].includes(style) && Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${76 + i * 10} ${top + 13}Q${65 + i * 12} ${cy - 3} ${i < 5 ? 65 - i * 2 : 175 + (i - 5) * 2} ${cy + (c.hair.length === "long" ? 89 : 50)}`} fill="none" stroke={c.hair.color} strokeWidth={style === "locks" ? 9 : 6} strokeLinecap="round" strokeDasharray={style === "braids" ? "3 2" : undefined} />)}
    <path d={`M${120 - rx + 15} ${top + 6}Q110 ${top - 4} 133 ${top + 1}`} fill="none" stroke="white" strokeOpacity=".13" strokeWidth="5" strokeLinecap="round" />
  </g>;
}
function Pet({ config: c, grad, accessories: a }: DrawProps) {
  const cat = c.type === "cat", p = c.pet, rx = p.silhouette === "broad" ? 63 : p.silhouette === "slim" ? 48 : 55;
  const body = p.silhouette === "long" ? 75 : p.silhouette === "broad" ? 60 : 48;
  const cy = p.size === "small" ? 176 : p.size === "large" ? 145 : 157;
  const top = cy - 61;
  return <>
    <g className="avatar-tail"><path d={p.tail === "curled" ? "M160 248Q227 281 210 225Q193 202 187 234" : p.tail === "short" ? "M159 259Q181 267 183 253" : cat ? "M160 261Q212 296 211 212Q207 176 194 185" : "M160 254Q196 267 210 222"} fill="none" stroke={grad("skin")} strokeWidth={p.tail === "fluffy" ? 25 : 14} strokeLinecap="round" /></g>
    <ellipse cx="120" cy="247" rx={body} ry={p.size === "small" ? 43 : 50} fill={grad("skin")} />
    {p.markings === "patches" || p.markings === "points" || p.markings === "saddle" ? <ellipse cx="143" cy="245" rx={body * .6} ry="29" fill="#392d28" opacity=".7" /> : null}
    {[1, -1].map((s) => <g key={s}><ellipse cx={120 + s * 26} cy="276" rx="15" ry="24" fill={grad("skin")} /><ellipse cx={120 + s * 26} cy="295" rx="19" ry="8" fill={grad("skin")} /></g>)}
    {(a.includes("collar") || a.includes("tag") || a.includes("bandana") || a.includes("bow")) && <path d={`M77 ${cy + 43}Q120 ${cy + 67} 163 ${cy + 43}`} fill="none" stroke="#759c94" strokeWidth="11" />}
    {a.includes("harness") && <path d="M86 218L154 275M154 218L86 275" stroke="#bb765b" strokeWidth="10" />}
    {a.includes("bandana") && <path d={`M84 ${cy + 47}L120 ${cy + 85} 156 ${cy + 47}Q120 ${cy + 65} 84 ${cy + 47}`} fill="#b97e66" />}
    {a.includes("tag") && <circle cx="120" cy={cy + 62} r="9" fill="#d6b36c" />}
    {a.includes("bow") && <path d={`M120 ${cy + 59}L97 ${cy + 45}V${cy + 70}Z M120 ${cy + 59}L143 ${cy + 45}V${cy + 70}Z`} fill="#8d6f98" />}
    <g className="avatar-head">
      {[-1, 1].map((s) => <g key={s}>{["floppy", "long", "folded", "rounded"].includes(p.ears) ? <ellipse cx={120 + s * (rx - 1)} cy={p.ears === "rounded" ? top + 15 : cy + (p.ears === "long" ? 6 : -10)} rx={p.ears === "folded" ? 14 : 18} ry={p.ears === "long" ? 57 : p.ears === "rounded" ? 22 : p.ears === "folded" ? 28 : 40} transform={`rotate(${s * -12} ${120 + s * rx} ${cy})`} fill={grad("skin")} /> : <path d={`M${120 + s * (rx - 18)} ${top + 28}Q${120 + s * (rx + 14)} ${top - (p.ears === "large" ? 38 : 18)} ${120 + s * (rx - 3)} ${top - 18}L${120 + s * (rx + 5)} ${top + 40}Z`} fill={grad("skin")} />}{!["floppy", "long", "folded", "rounded"].includes(p.ears) && <path d={`M${120 + s * (rx - 12)} ${top + 20}L${120 + s * (rx - 2)} ${top - 10}L${120 + s * (rx + 2)} ${top + 28}Z`} fill="#b9837b" opacity=".55" />}{p.ears === "tufted" && <path d={`M${120 + s * rx} ${top - 8}l${s * 4} -18 -9 9 1 -16 -8 20`} stroke={c.pet.color} strokeWidth="5" fill="none" />}</g>)}
      <ellipse cx="120" cy={cy} rx={rx} ry={p.muzzle === "long" ? 67 : p.muzzle === "flat" ? 53 : 60} fill={grad("skin")} />
      {(p.markings === "mask" || p.markings === "patches") && <><ellipse cx="88" cy={cy - 8} rx="22" ry="32" fill="#302e2c" opacity=".7" /><path d={`M108 ${top + 7}Q120 ${top} 132 ${top + 7}L138 ${cy + 30}H102Z`} fill="#f1ebde" opacity=".75" /></>}
      {p.markings === "points" && <ellipse cx="120" cy={cy + 14} rx="41" ry="42" fill="#534038" opacity=".6" />}
      {p.markings === "tabby" && [0, 1, 2].map((i) => <path key={i} d={`M${106 + i * 14} ${top + 5}l${i === 1 ? 0 : i === 0 ? 7 : -7} 25 M${120 - rx + 3} ${cy + i * 10}l13 4 M${120 + rx - 3} ${cy + i * 10}l-13 4`} stroke="#352f2b" strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" />)}
      {p.markings === "spots" && [-1, 1].flatMap((s) => [0, 1, 2, 3].map((i) => <ellipse key={s + ":" + i} cx={120 + s * (35 + i % 2 * 9)} cy={cy - 35 + i * 16} rx="5" ry="7" fill="none" stroke="#694a31" strokeWidth="3" />))}
      {p.fur === "curly" && [-1, 1].flatMap((s) => [0, 1, 2, 3, 4].map((i) => <circle key={s + ":" + i} cx={120 + s * (rx - 6)} cy={top + 17 + i * 19} r="12" fill={grad("skin")} />))}
      {p.fur === "long" && [-1, 1].map((s) => <path key={s} d={`M${120 + s * (rx - 5)} ${cy + 3}l${s * 11} 15 -4 9 ${s * -9} -2 ${s * 6} 11 ${s * -13} -3`} fill={grad("skin")} />)}
      <Eyes x={120} y={cy - 6} color={p.eyeColor} shape={cat ? "almond" : "round"} pet />
      <ellipse cx="120" cy={cy + 26} rx={p.muzzle === "wide" ? 36 : p.muzzle === "long" ? 25 : p.muzzle === "flat" ? 18 : p.muzzle === "short" ? 22 : 28} ry={p.muzzle === "long" ? 25 : p.muzzle === "short" || p.muzzle === "flat" ? 13 : 18} fill={p.markings === "mask" || p.markings === "patches" ? "#eee5d6" : grad("nose")} />
      <path d={`M${cat ? 111 : 108} ${cy + 16}Q120 ${cy + 9} ${cat ? 129 : 132} ${cy + 16}Q125 ${cy + 28} 120 ${cy + 28}Q115 ${cy + 28} ${cat ? 111 : 108} ${cy + 16}`} fill={cat ? "#b77879" : "#302724"} />
      <path d={`M120 ${cy + 28}V${cy + 34}M120 ${cy + 34}Q111 ${cy + 42} 105 ${cy + 35}M120 ${cy + 34}Q129 ${cy + 42} 135 ${cy + 35}`} fill="none" stroke="#574238" strokeWidth="2" strokeLinecap="round" />
      {cat && [-1, 1].flatMap((s) => [-1, 0, 1].map((i) => <path key={s + ":" + i} d={`M${120 + s * 19} ${cy + 28 + i * 4}l${s * 34} ${i * 8}`} stroke="#f3e8d7" strokeWidth="1.5" strokeOpacity=".8" />))}
      <ellipse cx="120" cy={cy - 4} rx={rx} ry="56" fill={grad("sheen")} />
      <HeadAccessories accessories={a} cy={cy - 6} rx={rx} top={top} />
    </g>
    <BodyAccessories accessories={a} y={cy + 40} width={body} />
  </>;
}
function HeadAccessories({ accessories: a, cy, rx, top }: { accessories: string[]; cy: number; rx: number; top: number }) {
  const has = (id: string) => a.includes(id);
  return <>
    {(has("glasses") || has("sunglasses")) && <g fill={has("sunglasses") ? "#253242" : "#e3effa"} fillOpacity={has("sunglasses") ? .9 : .15} stroke="#453c36" strokeWidth="4"><rect x="82" y={cy - 11} width="31" height="25" rx="10" /><rect x="127" y={cy - 11} width="31" height="25" rx="10" /><path d={`M113 ${cy - 1}Q120 ${cy - 7} 127 ${cy - 1} M82 ${cy - 3}L${120 - rx} ${cy - 6} M158 ${cy - 3}L${120 + rx} ${cy - 6}`} fill="none" /></g>}
    {has("headphones") && <><path d={`M${120 - rx - 9} ${cy}V${top + 36}Q120 ${top - 32} ${120 + rx + 9} ${top + 36}V${cy}`} stroke="#525569" strokeWidth="12" fill="none" /><rect x={120 - rx - 17} y={cy - 14} width="21" height="36" rx="9" fill="#7d8197" /><rect x={120 + rx - 4} y={cy - 14} width="21" height="36" rx="9" fill="#7d8197" /></>}
    {has("earbuds") && [-1, 1].map((s) => <rect key={s} x={120 + s * rx - 3} y={cy + 5} width="7" height="21" rx="3" fill="#f8f5ee" />)}
    {has("earrings") && [-1, 1].map((s) => <circle key={s} cx={120 + s * rx} cy={cy + 25} r="6" fill="none" stroke="#dab45f" strokeWidth="3" />)}
    {(has("cap") || has("beanie") || has("hat") || has("festive-hat") || has("party-hat") || has("chef-hat")) && <g>
      {has("chef-hat") ? <><rect x="80" y={top - 3} width="80" height="24" rx="6" fill="#e7e4d9" />{[95, 120, 145].map((x) => <circle key={x} cx={x} cy={top - 10} r="23" fill="#f8f6ef" />)}</> : has("party-hat") ? <><path d={`M88 ${top + 17}L120 ${top - 40} 152 ${top + 17}Z`} fill="#c5a063" /><circle cx="120" cy={top - 40} r="7" fill="#f6e3ac" /></> : has("festive-hat") ? <><path d={`M${120 - rx - 3} ${top + 16}Q111 ${top - 44} 170 ${top - 14}L171 ${top + 14}Q131 ${top - 6} ${120 + rx} ${top + 16}Z`} fill="#ad534a" /><path d={`M${120 - rx - 3} ${top + 18}H${120 + rx}`} stroke="#f1eee3" strokeWidth="14" strokeLinecap="round" /><circle cx="170" cy={top + 10} r="10" fill="#f1eee3" /></> : <><path d={`M${120 - rx - 6} ${top + 25}Q${120 - rx} ${top - 24} 120 ${top - 21}Q${120 + rx} ${top - 24} ${120 + rx + 6} ${top + 25}Z`} fill={has("beanie") ? "#7d927f" : "#bd9471"} /><path d={`M${120 - rx - (has("hat") ? 17 : 6)} ${top + 26}H${120 + rx + (has("hat") || has("cap") ? 20 : 6)}`} stroke={has("beanie") ? "#657a68" : "#a67c55"} strokeWidth="13" strokeLinecap="round" />{has("beanie") && <circle cx="120" cy={top - 21} r="9" fill="#7d927f" />}</>}
    </g>}
    {has("headband") && <path d={`M${120 - rx} ${top + 30}Q120 ${top - 10} ${120 + rx} ${top + 30}`} stroke="#b487a5" strokeWidth="10" fill="none" />}
  </>;
}
function BodyAccessories({ accessories: a, y, width }: { accessories: string[]; y: number; width: number }) {
  return <>
    {a.includes("scarf") && <><path d={`M85 ${y + 9}Q120 ${y + 37} 155 ${y + 9}`} stroke="#ba9570" strokeWidth="14" fill="none" /><path d={`M131 ${y + 22}L138 ${Math.min(284, y + 71)}`} stroke="#ba9570" strokeWidth="12" /></>}
    {a.includes("necklace") && <path d={`M96 ${y + 20}Q120 ${y + 57} 144 ${y + 20}`} fill="none" stroke="#e3bd6a" strokeWidth="2" />}
    {a.includes("watch") && <rect x={120 - width - 7} y="267" width="17" height="10" rx="3" fill="#d8cba7" stroke="#746b59" strokeWidth="2" />}
    {a.includes("mug") && <g transform="translate(155 245)"><rect width="26" height="27" rx="6" fill="#f0e4d2" /><path d="M26 5Q42 4 34 21H26" fill="none" stroke="#d1bca5" strokeWidth="5" /></g>}
    {a.includes("spoon") && <g transform="rotate(-20 180 245)"><path d="M180 224V276" stroke="#ba986f" strokeWidth="5" strokeLinecap="round" /><ellipse cx="180" cy="213" rx="10" ry="15" fill="#cbb18d" /></g>}
    {a.includes("notebook") && <rect x="145" y="238" width="38" height="45" rx="4" fill="#9c8066" stroke="#e9d9bd" strokeWidth="3" transform="rotate(10 165 260)" />}
    {a.includes("teddy") && <g fill="#bd9a70"><circle cx="153" cy="256" r="16" /><circle cx="140" cy="244" r="6" /><circle cx="165" cy="244" r="6" /><ellipse cx="153" cy="277" rx="18" ry="17" /><circle cx="149" cy="253" r="2" fill="#4e3f30" /><circle cx="159" cy="253" r="2" fill="#4e3f30" /></g>}
    {a.includes("toy") && <circle cx="170" cy="282" r="16" fill="#d1a965" stroke="#f0d5a4" strokeWidth="5" />}
    {a.includes("pumpkin") && <g><ellipse cx="176" cy="281" rx="18" ry="15" fill="#bf8043" /><path d="M176 266V260" stroke="#68835e" strokeWidth="5" /></g>}
  </>;
}
