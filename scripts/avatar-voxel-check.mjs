import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
export async function checkVoxelAvatars({ browser, sizes, out, errors }) {
  const page = await browser.newPage();
  const requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /<path>|<svg>|attribute d:/.test(message.text())) errors.push(message.text()); });
  page.on("request", request => { if (/api\.dicebear/.test(request.url())) requests.push(request.url()); });
  await page.clock.install({ time: new Date(2026, 9, 11, 14, 30) });
  await page.goto("http://127.0.0.1:4173");
  const walker = page.locator(".avatar-greeting-walk");
  await walker.waitFor();
  const start = await walker.evaluate(el => el.getBoundingClientRect().x);
  await new Promise(resolve => setTimeout(resolve, 6000));
  assert.ok(await walker.evaluate(el => el.getBoundingClientRect().x) > start + 3, "real-time voxel walking, even with Spotify playing");
  assert.equal(await page.locator(".avatar-greeting [data-engine='dicebear']").count(), 1);
  for (const size of sizes) {
    await page.setViewportSize(size);
    const positions = await walker.evaluate(el => {
      const animation = el.getAnimations()[0]; animation.pause();
      const duration = Number(animation.effect.getTiming().duration);
      const values = [.07, .33, .4, .65, .77].map(fraction => { animation.currentTime = duration * fraction; return el.getBoundingClientRect().x; });
      return values;
    });
    const width = await page.locator(".avatar-greeting").evaluate(el => el.clientWidth);
    assert.ok(Math.abs(positions[1] - positions[0] - width + 84) < 2, "full banner traversal");
    assert.ok(Math.abs(positions[1] - positions[2]) < .2, "pause at right edge");
    assert.ok(positions[3] < positions[2], "walks back left");
    assert.ok(Math.abs(positions[0] - positions[4]) < .2, "returns to left edge");
    const turn = await page.locator(".avatar-greeting-facing").evaluate(el => { const a = el.getAnimations()[0]; a.pause(); a.currentTime = Number(a.effect.getTiming().duration) * .5; return getComputedStyle(el).transform; });
    assert.ok(Number(turn.match(/matrix\(([^,]+)/)[1]) < 0, "consistent left orientation");
    await page.screenshot({ path: out + "/voxel-home-" + size.name + ".png", fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "voxel home overflow");
  }
  await page.goto("http://127.0.0.1:4173/settings#profils");
  await page.getByRole("button", { name: /Emma.*Personne/ }).click();
  const open = () => page.getByRole("button", { name: "Avatar — ouvrir Avatar Studio", exact: true }).click();
  await open();
  const tabs = page.getByRole("navigation", { name: "Catégories de l’avatar" });
  const preview = page.locator(".avatar-preview .avatar-renderer");
  for (const [name, type] of [["Adulte", "adult"], ["Adolescent", "teen"], ["Enfant", "child"], ["Bébé", "baby"], ["Chien", "dog"], ["Chat", "cat"]]) {
    await tabs.getByRole("button", { name: "Type", exact: true }).click();
    await page.getByRole("group", { name: "Qui représente cet avatar ?" }).getByRole("button", { name, exact: true }).click();
    await page.waitForFunction(type => document.querySelector(".avatar-preview .avatar-renderer")?.dataset.type === type, type);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await preview.getAttribute("data-fallback"), null, "local render succeeds");
    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.screenshot({ path: out + "/voxel-studio-" + type + "-" + size.name + ".png" });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "studio overflow " + type);
    }
  }
  await page.setViewportSize({ width: 1200, height: 900 });
  for (const [species, breeds] of [["Chien", ["Golden Retriever", "Cocker", "Teckel", "Husky", "Shiba Inu"]], ["Chat", ["Européen", "Maine Coon", "Siamois", "Persan", "Bengal"]]]) {
    await tabs.getByRole("button", { name: "Type", exact: true }).click();
    await page.getByRole("group", { name: "Qui représente cet avatar ?" }).getByRole("button", { name: species, exact: true }).click();
    await tabs.getByRole("button", { name: "Race", exact: true }).click();
    for (const name of breeds) { await page.getByRole("button", { name, exact: true }).click(); await page.waitForFunction(name => [...document.querySelectorAll(".avatar-options button")].some(el => el.textContent === name && el.getAttribute("aria-pressed") === "true"), name); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.screenshot({ path: out + "/voxel-pet-" + name.replaceAll(" ", "-") + ".png" }); }
  }
  await tabs.getByRole("button", { name: "Type", exact: true }).click();
  await page.getByRole("group", { name: "Qui représente cet avatar ?" }).getByRole("button", { name: "Adulte", exact: true }).click();
  await tabs.getByRole("button", { name: "Cheveux", exact: true }).click();
  const previousDrawing = await preview.innerHTML();
  await page.getByRole("button", { name: "Afro", exact: true }).click();
  assert.notEqual(await preview.innerHTML(), previousDrawing, "real DiceBear option changes drawing");
  assert.equal(await page.getByRole("button", { name: "Longueur", exact: true }).count(), 0, "no unsupported legacy controls");
  for (const [context, headwear, accessory] of [["kitchen", "chef-hat", "pan"], ["winter", "beanie", "scarf"], ["summer", "cap", null], ["spring", null, "flower"], ["music", null, null], ["night", null, null]]) {
    await page.getByRole("combobox", { name: "Voir en contexte" }).selectOption(context);
    if (headwear) { await preview.locator('[data-headwear="' + headwear + '"]').waitFor(); assert.equal(await preview.locator("[data-headwear]").count(), 1); }
    if (accessory) await preview.locator('[data-accessory="' + accessory + '"]').waitFor();
    if (context === "music") await page.waitForFunction(() => document.querySelector(".avatar-preview .avatar-renderer")?.dataset.motion === "dance");
    if (context === "night") await page.waitForFunction(() => document.querySelector(".avatar-preview .avatar-renderer")?.dataset.motion === "sleep");
    await page.screenshot({ path: out + "/voxel-context-" + context + ".png" });
  }
  await page.getByRole("combobox", { name: "Voir en contexte" }).selectOption("base");
  await page.getByRole("button", { name: "Tester le saut", exact: true }).click();
  await preview.locator(".voxel-jump").waitFor();
  assert.equal(await preview.locator(".voxel-jump").evaluate(el => getComputedStyle(el).animationName), "voxel-jump");
  await page.screenshot({ path: out + "/voxel-jump.png" });
  await page.getByRole("button", { name: "Réinitialiser", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Annuler", exact: true }).click();
  await page.evaluate(() => window.fixtureApp.avatarSaveFail = true);
  await page.getByRole("button", { name: "Terminé", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page.evaluate(() => window.fixtureApp.avatarSaveFail = false);
  await page.getByRole("button", { name: "Terminé", exact: true }).click();
  const saved = await page.evaluate(() => window.fixtureApp.profiles[0].avatarConfig);
  assert.equal(saved.engine, "dicebear"); assert.equal(saved.options.topVariant, "afro"); assert.equal(saved.version, 2);
  await open();
  await page.getByRole("button", { name: "Aléatoire", exact: true }).click();
  await page.getByRole("button", { name: "Retour au profil", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.fixtureApp.profiles[0].avatarConfig), saved, "cancel preserves saved identity");
  await open();
  await page.getByRole("button", { name: "Aléatoire", exact: true }).click();
  await page.getByRole("button", { name: "Terminé", exact: true }).click();
  assert.notEqual(await page.evaluate(() => window.fixtureApp.profiles[0].avatarConfig.seed), saved.seed, "random creates new stable seed");
  await open();
  await page.getByRole("button", { name: "Réinitialiser", exact: true }).click();
  await page.getByRole("button", { name: "Confirmer la réinitialisation", exact: true }).click();
  await page.getByRole("button", { name: "Terminé", exact: true }).click();
  assert.equal(await page.evaluate(() => window.fixtureApp.profiles[0].avatarConfig.options.topVariant), "sideSwept");
  await page.goto("http://127.0.0.1:4173");
  await page.evaluate(() => { window.fixtureFamily(); window.fixtureApp.timers = []; window.fixtureEmit(); });
  await page.getByRole("button", { name: "Calendrier", exact: true }).click();
  await page.getByRole("region", { name: "Avatars de la famille" }).waitFor();
  assert.equal(await page.getByRole("region", { name: "Avatars de la famille" }).locator(".avatar-renderer").count(), 5);
  await page.screenshot({ path: out + "/voxel-family-calendar.png" });
  await page.getByRole("button", { name: "Emma", exact: true }).click();
  await page.getByRole("region", { name: "Avatar du calendrier sélectionné" }).locator(".avatar-greeting").waitFor();
  await page.screenshot({ path: out + "/voxel-profile-calendar.png" });
  await page.getByRole("button", { name: "Famille", exact: true }).click();
  await page.evaluate(() => { window.fixtureMusic.playback.isPlaying = false; window.fixtureEmit(); });
  await page.waitForFunction(() => document.querySelector(".avatar-family-scene .avatar-renderer")?.dataset.motion === "idle");
  await page.evaluate(() => { window.fixtureMusic.playback.isPlaying = true; window.fixtureEmit(); });
  await page.waitForFunction(() => document.querySelector(".avatar-family-scene .avatar-renderer")?.dataset.motion === "dance");
  assert.equal(await page.locator(".avatar-family-scene .avatar-body").first().evaluate(el => getComputedStyle(el).animationName), "voxel-dance");
  await page.evaluate(() => { window.fixtureMusic.playback = null; window.fixtureEmit(); });
  await page.waitForFunction(() => document.querySelector(".avatar-family-scene .avatar-renderer")?.dataset.motion === "idle");
  await page.clock.setSystemTime(new Date(2026, 9, 11, 23, 30)); await page.clock.runFor(61_000);
  await page.waitForFunction(() => document.querySelector(".avatar-family-scene .avatar-renderer")?.dataset.motion === "sleep");
  await page.screenshot({ path: out + "/voxel-family-night.png" });
  await page.goto("http://127.0.0.1:4173/settings#apparence");
  await page.getByRole("checkbox", { name: "Activer la promenade dans le bandeau", exact: true }).uncheck();
  await page.goto("http://127.0.0.1:4173");
  await page.locator('.avatar-greeting[data-walking="false"]').waitFor();
  assert.equal(await walker.evaluate(el => getComputedStyle(el).animationName), "none");
  await page.goto("http://127.0.0.1:4173/settings#apparence");
  await page.getByRole("checkbox", { name: "Afficher les avatars", exact: true }).uncheck();
  await page.goto("http://127.0.0.1:4173"); await page.getByRole("heading", { level: 1 }).waitFor();
  assert.equal(await page.locator(".avatar-renderer, .avatar-greeting, .avatar-family-scene").count(), 0);
  await page.goto("http://127.0.0.1:4173/settings#apparence");
  await page.getByRole("checkbox", { name: "Afficher les avatars", exact: true }).check();
  await page.getByRole("checkbox", { name: "Activer la promenade dans le bandeau", exact: true }).check();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("status").filter({ hasText: "La promenade est arrêtée" }).waitFor();
  await page.goto("http://127.0.0.1:4173"); await walker.waitFor();
  assert.equal(await walker.evaluate(el => getComputedStyle(el).animationName), "none");
  const placedFace = page.locator('.avatar-greeting use[transform]').first();
  assert.notEqual(await placedFace.evaluate(el => getComputedStyle(el).transform), "none", "reduced motion preserves native face placement");
  await page.screenshot({ path: out + "/voxel-reduced-motion.png" });
  await page.evaluate(() => { window.fixtureApp.profiles = window.fixtureApp.profiles.map(p => ({ ...p, avatarConfig: undefined })); window.fixtureEmit(); });
  await page.locator('.avatar-greeting[aria-label="Avatar de Emma"] svg').waitFor();
  await page.evaluate(() => { window.fixtureApp.profiles = []; window.fixtureEmit(); });
  await page.locator('.avatar-greeting[aria-label="Avatar HomeCal"] svg').waitFor();
  assert.deepEqual(requests, [], "no DiceBear network requests"); assert.deepEqual(errors, [], "no browser or SVG errors");
  await writeFile(out + "/voxel-report.json", JSON.stringify({ viewports: sizes, checks: ["local DiceBear generation", "six types", "ten pet breeds", "live options", "random/save/cancel/reset/error retry", "real-time walk", "both directions and pauses", "jump", "seasonal and cooking priority", "Spotify playing/paused/stopped", "family and selected calendar", "night", "settings persistence", "OS reduced motion", "legacy and empty fallback"], requests, errors }, null, 2));
  await page.close();
  console.log("PASS: DiceBear Voxel Art, Studio, local pets, migration, context, real-time walk, pauses, jump, music, calendar and persistent settings.");
}
