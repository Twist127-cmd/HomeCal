import { mix } from "@/theme/tokens";
import type { VoxelPresentation } from "../VoxelContextEngine";
export function VoxelBlock({ x, y, width, height, depth = 6, color }: { x: number; y: number; width: number; height: number; depth?: number; color: string }) {
  const up = depth * .8;
  return <g><path d={`M${x} ${y}h${width}v${height}h-${width}Z`} fill={color} /><path d={`M${x} ${y}l${depth} -${up}h${width}l-${depth} ${up}Z`} fill={mix(color, "#ffffff", .3)} /><path d={`M${x + width} ${y}l${depth} -${up}v${height}l-${depth} ${up}Z`} fill={mix(color, "#000000", .25)} /></g>;
}
export function VoxelAccessories({ presentation: p, color, pet }: { presentation: VoxelPresentation; color: string; pet: boolean }) {
  const hat = p.headwear;
  return <g className="voxel-accessories" aria-hidden="true">
    {hat && <g data-headwear={hat} className="voxel-headwear">
      {hat === "chef-hat" ? <><VoxelBlock x={26} y={23} width={66} height={10} depth={10} color="#e6e4dd" /><VoxelBlock x={27} y={13} width={63} height={12} depth={11} color="#faf8ef" />{[30, 50, 70].map(x => <VoxelBlock key={x} x={x} y={5} width={18} height={12} depth={9} color="#faf8ef" />)}</> : hat === "party-hat" ? <><VoxelBlock x={42} y={20} width={35} height={10} depth={9} color={color} /><VoxelBlock x={48} y={10} width={23} height={12} depth={7} color={color} /><VoxelBlock x={54} y={3} width={11} height={9} depth={5} color="#f3d59a" /></> : <><VoxelBlock x={24} y={22} width={68} height={11} depth={11} color={hat === "festive-hat" ? "#af534c" : color} /><VoxelBlock x={29} y={11} width={58} height={14} depth={11} color={hat === "festive-hat" ? "#af534c" : color} />{hat === "beanie" && <VoxelBlock x={51} y={4} width={15} height={9} depth={7} color={color} />}{hat === "cap" && <VoxelBlock x={23} y={30} width={70} height={4} depth={16} color={color} />}{hat === "festive-hat" && <><VoxelBlock x={24} y={28} width={68} height={6} depth={11} color="#f8f3e9" /><VoxelBlock x={82} y={13} width={9} height={9} color="#f8f3e9" /></>}</>}
    </g>}
    {p.accessories.includes("scarf") && <g data-accessory="scarf"><VoxelBlock x={39} y={pet ? 86 : 87} width={pet ? 40 : 43} height={6} depth={6} color={color} /><VoxelBlock x={70} y={93} width={7} height={14} depth={4} color={color} /></g>}
    {p.accessories.includes("apron") && <g data-accessory="apron"><VoxelBlock x={47} y={92} width={26} height={16} depth={3} color="#a1b9a5" /><path d="M48 87v8m24-8v8" stroke="#a1b9a5" strokeWidth="4" /></g>}
    {p.accessories.includes("pan") && <g data-accessory="pan"><VoxelBlock x={84} y={99} width={23} height={11} depth={8} color="#6d777e" /><VoxelBlock x={81} y={97} width={28} height={4} depth={8} color="#a0abb0" /><VoxelBlock x={107} y={101} width={15} height={4} depth={4} color="#4a5059" /><path d="M91 93v-6m8 4v-6" stroke="#d4d4cd" strokeWidth="2" opacity=".7" /></g>}
    {p.accessories.includes("mug") && <g data-accessory="mug"><VoxelBlock x={88} y={97} width={12} height={13} depth={5} color="#ebdbc1" /><path d="M101 100h6v7h-6" stroke="#cbb895" strokeWidth="3" fill="none" /></g>}
    {p.accessories.includes("flower") && <g data-accessory="flower"><path d="M99 104v-14m0 9-5-4" stroke="#708b68" strokeWidth="2" /><VoxelBlock x={95} y={86} width={8} height={7} depth={3} color="#d791ae" /><VoxelBlock x={98} y={88} width={3} height={3} depth={1} color="#f1d29b" /></g>}
  </g>;
}
