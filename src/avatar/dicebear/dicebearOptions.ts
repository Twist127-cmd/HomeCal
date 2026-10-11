import definition from "@dicebear/styles/voxel-art.json";

// The installed, pinned style is the source of truth, including its variant names.
export const VOXEL_VARIANTS = Object.fromEntries(Object.entries(definition.components).filter(([key]) => key !== "animation").map(([key, component]) => [key, Object.keys(component.variants)])) as Record<string, string[]>;
export const VOXEL_COLORS = Object.fromEntries(Object.entries(definition.colors).map(([key, color]) => [key, color.values])) as Record<string, string[]>;
export const VARIANT_LABELS: Record<string, string> = {
  short: "Courts", spiky: "Ébouriffés", bowl: "Coupe au bol", sideSwept: "Mèche sur le côté", curly: "Bouclés", mohawk: "Crête", buns: "Chignons", ponytail: "Queue de cheval", bob: "Carré", shoulderLength: "Mi-longs", longStraight: "Longs et lisses", longWavy: "Longs et ondulés", partedLong: "Longs avec raie", braids: "Tresses", twinTails: "Couettes", cap: "Casquette", beanie: "Bonnet", animalEars: "Oreilles fantaisie", bunnyEars: "Oreilles de lapin", afro: "Afro", halfShaved: "Côté rasé",
  open: "Ouverts", soft: "Doux", happy: "Joyeux", sleepy: "Somnolents", side: "Regard de côté", closed: "Fermés", wide: "Grands", star: "Étoilés", flat: "Droit", raised: "Relevés", angry: "Expressifs", blush: "Rosées", pixel: "Pixels", freckles: "Taches de rousseur", block: "Classique", small: "Petit", tall: "Allongé", smile: "Sourire", bigSmile: "Grand sourire", ooh: "Surpris", tongue: "Espiègle", smirk: "Malicieux", laugh: "Rieur", wideSmile: "Sourire ouvert", frown: "Soucieux", grin: "Sourire franc",
  full: "Complète", mustache: "Moustache", goatee: "Bouc", stubble: "Courte", round: "Rondes", square: "Carrées", shades: "Soleil", cat: "Papillon", visor: "Visière", plain: "Simple", stripes: "Rayures", jacket: "Veste", checker: "Carreaux", overalls: "Salopette", hoodie: "Sweat à capuche", tie: "Chemise et cravate", coat: "Manteau", dress: "Robe", suit: "Costume",
};
