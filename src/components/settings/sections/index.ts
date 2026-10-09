import { Bot, Car, Clapperboard, Home, LogOut, MapPin, Mic, Monitor, Music, Plug, Timer, Users, Volume2, type LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import { features } from "@/lib/features";
import { AccountSection } from "./AccountSection";
import { AssistantSection } from "./AssistantSection";
import { DisplaySection } from "./DisplaySection";
import { HouseholdSection } from "./HouseholdSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { MusicSection } from "./MusicSection";
import { PlacesSection } from "./PlacesSection";
import { ProfilesSection } from "./ProfilesSection";
import { ScenesSection } from "./ScenesSection";
import { TimersSection } from "./TimersSection";
import { TravelSection } from "./TravelSection";
import { VoiceSection } from "./VoiceSection";
import { WakeWordSection } from "./WakeWordSection";

export interface SettingsSectionDef {
  /** URL hash (#voix) — keeps the active section on refresh */
  id: string;
  /** same title as the section card (unchanged from the former single page) */
  title: string;
  icon: LucideIcon;
  Component: ComponentType;
  /** feature flag, evaluated as before */
  enabled?: () => boolean;
}

/** The settings groups that already existed, in their original order — no new category. */
export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  { id: "foyer", title: "Foyer", icon: Home, Component: HouseholdSection },
  { id: "profils", title: "Profils", icon: Users, Component: ProfilesSection },
  { id: "lieux", title: "Lieux favoris", icon: MapPin, Component: PlacesSection },
  { id: "affichage", title: "Affichage", icon: Monitor, Component: DisplaySection },
  { id: "trajets", title: "Trajets", icon: Car, Component: TravelSection },
  { id: "musique", title: "Musique", icon: Music, Component: MusicSection, enabled: () => features.spotify },
  { id: "minuteurs", title: "Minuteurs", icon: Timer, Component: TimersSection, enabled: () => features.timers },
  { id: "scenes", title: "Scènes", icon: Clapperboard, Component: ScenesSection, enabled: () => features.scenes },
  { id: "assistant", title: "Assistant (LLM local)", icon: Bot, Component: AssistantSection },
  { id: "assistant-vocal", title: "Assistant vocal", icon: Mic, Component: WakeWordSection, enabled: () => features.wakeWord },
  { id: "voix", title: "Voix et notifications", icon: Volume2, Component: VoiceSection },
  { id: "integrations", title: "Intégrations", icon: Plug, Component: IntegrationsSection },
  { id: "compte", title: "Compte", icon: LogOut, Component: AccountSection },
];

export const visibleSections = () => SETTINGS_SECTIONS.filter((s) => !s.enabled || s.enabled());
