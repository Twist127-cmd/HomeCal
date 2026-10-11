import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ update: vi.fn(), doc: vi.fn((...path: unknown[]) => path) }));
vi.mock("firebase/firestore", () => ({ updateDoc: mocks.update, doc: mocks.doc }));
import { saveAvatarConfig } from "@/avatar/data";
import { defaultAvatar } from "@/avatar/config";
import { normalizeVoxelAvatar } from "@/avatar/dicebear/dicebearConfig";
import type { Firestore } from "firebase/firestore";
describe("avatar storage preserves profile data", () => {
  beforeEach(() => { mocks.update.mockReset(); mocks.doc.mockClear(); });
  it("patches just the normalized avatar field in the existing household profile", async () => {
    const db = {} as Firestore, config = defaultAvatar("cat");
    await saveAvatarConfig(db, "home", "milo", config);
    expect(mocks.doc).toHaveBeenCalledWith(db, "households", "home", "profiles", "milo");
    const migrated = normalizeVoxelAvatar(config, "milo");
    expect(mocks.update).toHaveBeenCalledWith([db, "households", "home", "profiles", "milo"], { avatarConfig: migrated, avatarSeed: migrated.seed });
    expect(Object.keys(mocks.update.mock.calls[0][1])).toEqual(["avatarConfig", "avatarSeed"]);
  });
  it("propagates write failures so the studio keeps the draft", async () => {
    mocks.update.mockRejectedValueOnce(new Error("offline"));
    await expect(saveAvatarConfig({} as Firestore, "home", "member", defaultAvatar())).rejects.toThrow("offline");
  });
});
