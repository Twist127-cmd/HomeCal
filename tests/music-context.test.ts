import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";

const { music } = vi.hoisted(() => ({ music: {
  getCurrentPlayback: vi.fn().mockResolvedValue(null),
  getPlaylists: vi.fn().mockResolvedValue([]),
  getRecent: vi.fn().mockResolvedValue([]),
  getDevices: vi.fn().mockResolvedValue([]),
} }));
vi.mock("@/components/app/AppProvider", () => ({ useApp: () => ({ music, spotify: { cipher: "sealed", name: "Test", product: "unknown" }, user: { uid: "test" } }) }));
vi.mock("@/lib/features", () => ({ features: { spotify: true } }));
vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/firebase/client", () => ({ firestore: vi.fn() }));
vi.mock("@/lib/data/household", () => ({ saveSpotifyConnection: vi.fn() }));
import { MusicContextProvider, useMusic, type MusicState } from "@/components/music/MusicContext";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("keeps panel loading callbacks stable after state updates, preventing request loops", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("document", { visibilityState: "hidden", addEventListener: vi.fn(), removeEventListener: vi.fn() });
  let state!: MusicState;
  let renderer!: ReactTestRenderer;
  function Probe() { state = useMusic(); return null; }
  await act(async () => { renderer = create(createElement(MusicContextProvider, null, createElement(Probe))); });
  try {
    const library = state.loadLibrary;
    const devices = state.loadDevices;
    await act(async () => { await library(); await devices(); });
    expect(state.loadLibrary).toBe(library);
    expect(state.loadDevices).toBe(devices);
    expect(state.premium).toBeNull();
    expect(music.getPlaylists).toHaveBeenCalledTimes(1);
    expect(music.getDevices).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => renderer.unmount());
  }
});
