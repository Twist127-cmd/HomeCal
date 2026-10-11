import type { AvatarConfig, AvatarType } from "./types";
export type Choice = { id: string; label: string };
const choices = (values: string) => values.split("|").map((s) => { const [id, label] = s.split(":"); return { id, label }; });
export const AVATAR_TYPES = choices("adult:Adulte|teen:Adolescent|child:Enfant|baby:Bébé|dog:Chien|cat:Chat");
export const SKIN_COLORS = ["#fbe3cf", "#efc8a5", "#dca67d", "#c48960", "#ad744f", "#935c40", "#76482f", "#593929", "#3c291f"];
export const HAIR_COLORS = ["#271d19", "#4c3023", "#815638", "#bf8e50", "#e3c184", "#a4532d", "#c8c4bd", "#f2ebe0", "#85608c"];
export const EYE_COLORS = ["#37251d", "#73513a", "#76804c", "#587d91", "#8c9caa", "#486257"];
export const OUTFIT_COLORS = ["#4e727c", "#7d8c74", "#a56d65", "#cfa362", "#535979", "#8a6f94", "#ded3bf", "#35363c", "#eee9e0"];
export const FUR_COLORS = ["#d9b576", "#ad764b", "#634837", "#302b2a", "#ebe2d1", "#8b939d", "#be8053", "#d6b7a5"];
export const BACKGROUNDS = choices("theme:Preset HomeCal|neutral:Neutre|warm:Sable|sky:Ciel|sage:Sauge|rose:Rose|night:Nuit");
export const FACE_SHAPES = choices("oval:Ovale|round:Rond|square:Carré|heart:Cœur|long:Allongé");
export const BODY_TYPES = choices("slim:Fin|average:Équilibré|broad:Large");
export const FACE_OPTIONS = {
  cheeks: choices("none:Naturelles|rosy:Rosées|freckles:Taches de rousseur"), ears: choices("small:Petites|normal:Classiques|prominent:Prononcées"),
  eyes: choices("almond:Amande|round:Ronds|wide:Ouverts"), iris: choices("small:Discrets|normal:Classiques|large:Expressifs"),
  brows: choices("soft:Doux|straight:Droits|arched:Arquées|thick:Fournis"), nose: choices("button:Arrondi|straight:Droit|wide:Large"),
  mouth: choices("smile:Sourire|neutral:Calme|wide:Grand sourire"), beard: choices("none:Rasé|short:Courte|long:Longue|mustache:Moustache|goatee:Bouc|sideburns:Favoris"),
};
export const HAIR_STYLES = choices("very-short:Très court|short:Court|medium:Mi-long|long:Long|curly:Bouclé|wavy:Ondulé|coily:Crépu|braids:Tresses|locks:Locks|bun:Chignon|ponytail:Queue de cheval|shaved:Rasé|bald:Chauve");
export const HAIR_LENGTHS = choices("short:Court|medium:Mi-long|long:Long");
export const HAIR_VOLUMES = choices("low:Discret|normal:Normal|full:Volumineux");
export const HAIR_TEXTURES = choices("straight:Lisse|wavy:Ondulé|curly:Bouclé|coily:Crépu");
export const OUTFITS = choices("casual:Casual|sport:Sport|chic:Chic|home:Maison|kitchen:Cuisine|winter:Hiver|summer:Été|pajamas:Pyjama|work:Travail|overalls:Salopette|tshirt:T-shirt|dress:Robe|sweatshirt:Sweat");
export const ACCESSORIES = choices("glasses:Lunettes|sunglasses:Lunettes de soleil|cap:Casquette|beanie:Bonnet|hat:Chapeau|headband:Serre-tête|earrings:Boucles d’oreilles|necklace:Collier|headphones:Casque audio|earbuds:Écouteurs|scarf:Foulard|bag:Sac|watch:Montre|schoolbag:Cartable|teddy:Doudou|toy:Jouet");
export const PET_ACCESSORIES = choices("collar:Collier|tag:Médaille|bandana:Bandana|harness:Harnais|bow:Nœud|scarf:Foulard|beanie:Bonnet");
export interface Breed { id: string; label: string; ears: string; muzzle: string; fur: string; markings: string; color: string; silhouette: string; tail: string }
const breed = (id: string, label: string, ears = "floppy", muzzle = "normal", fur = "smooth", markings = "none", color = "#d9b576", silhouette = "average", tail = "straight"): Breed => ({ id, label, ears, muzzle, fur, markings, color, silhouette, tail });
export const DOG_BREEDS: Breed[] = [
  breed("golden", "Golden Retriever", "floppy", "normal", "long"), breed("labrador", "Labrador", "floppy", "wide", "smooth", "none", "#ad764b", "broad"),
  breed("cocker", "Cocker", "long", "normal", "long", "none", "#ad764b"), breed("australian", "Berger Australien", "folded", "long", "long", "patches", "#8b939d"),
  breed("french-bulldog", "Bouledogue Français", "pointed", "short", "smooth", "patches", "#ad764b", "broad", "short"),
  breed("poodle", "Caniche", "floppy", "long", "curly", "none", "#ebe2d1", "slim"), breed("shiba", "Shiba Inu", "pointed", "normal", "smooth", "points", "#be8053", "average", "curled"),
  breed("chihuahua", "Chihuahua", "large", "short", "smooth", "none", "#d9b576", "slim"), breed("dachshund", "Teckel", "long", "long", "smooth", "points", "#634837", "long"),
  breed("husky", "Husky", "pointed", "long", "long", "mask", "#8b939d", "average", "fluffy"), breed("border-collie", "Border Collie", "folded", "long", "long", "patches", "#302b2a"),
  breed("german-shepherd", "Berger Allemand", "pointed", "long", "long", "saddle", "#ad764b"), breed("jack-russell", "Jack Russell", "folded", "normal", "smooth", "patches", "#ebe2d1", "slim"),
  breed("beagle", "Beagle", "long", "normal", "smooth", "patches", "#ad764b"), breed("mixed", "Type croisé"),
];
export const CAT_BREEDS: Breed[] = [
  breed("european", "Européen", "pointed", "short", "smooth", "tabby", "#8b939d"), breed("maine-coon", "Maine Coon", "tufted", "wide", "long", "tabby", "#634837", "broad", "fluffy"),
  breed("siamese", "Siamois", "large", "normal", "smooth", "points", "#ebe2d1", "slim"), breed("persian", "Persan", "rounded", "flat", "long", "none", "#ebe2d1", "broad", "fluffy"),
  breed("british", "British Shorthair", "rounded", "short", "smooth", "none", "#8b939d", "broad"), breed("bengal", "Bengal", "pointed", "normal", "smooth", "spots", "#d9b576", "slim"),
  breed("ragdoll", "Ragdoll", "rounded", "normal", "long", "points", "#ebe2d1", "broad", "fluffy"), breed("sphynx", "Sphynx", "large", "long", "hairless", "none", "#d6b7a5", "slim"),
  breed("birman", "Sacré de Birmanie", "pointed", "normal", "long", "points", "#ebe2d1"), breed("norwegian", "Norvégien", "tufted", "long", "long", "tabby", "#ad764b", "broad", "fluffy"),
  breed("mixed", "Type croisé", "pointed", "short", "smooth", "none", "#d9b576"),
];
export const PET_OPTIONS = { size: choices("small:Petit|medium:Moyen|large:Grand"), silhouette: choices("slim:Fine|average:Équilibrée|broad:Large|long:Allongée"), ears: choices("pointed:Dressées|rounded:Arrondies|floppy:Tombantes|long:Longues|folded:Pliées|large:Grandes|tufted:Avec plumets"), muzzle: choices("short:Court|normal:Classique|long:Allongé|wide:Large|flat:Plat"), fur: choices("smooth:Court|long:Long|curly:Bouclé|hairless:Sans poil"), markings: choices("none:Uni|patches:Taches|points:Extrémités foncées|mask:Masque|tabby:Tigré|spots:Tacheté|saddle:Selle"), tail: choices("straight:Droite|curled:Enroulée|fluffy:Touffue|short:Courte") };
export const isPet = (type: AvatarType) => type === "dog" || type === "cat";
export function applyBreed(config: AvatarConfig, id: string): AvatarConfig { const b = (config.type === "dog" ? DOG_BREEDS : CAT_BREEDS).find((b) => b.id === id); if (!b) return config; return { ...config, pet: { ...config.pet, breed: b.id, ears: b.ears, muzzle: b.muzzle, fur: b.fur, markings: b.markings, color: b.color, silhouette: b.silhouette, tail: b.tail } }; }
