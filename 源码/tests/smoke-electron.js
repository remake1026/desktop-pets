const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");

if (!process.versions.electron) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = require("node:child_process").spawn(require("electron"), [__filename, ...process.argv.slice(2)], {
    env, windowsHide: true, stdio: "inherit",
  });
  child.on("exit", code => { process.exitCode = code ?? 1; });
} else {
  const electron = require("electron");
  const { app, BrowserWindow } = electron;
  app.once("will-quit", () => { if (process.exitCode) app.exit(process.exitCode); });
  const root = process.env.LINE_PUPPY_TEST_ROOT || path.resolve(__dirname, "..");
  const entryName = `LinePuppySmoke-${process.pid}`;
  app.setPath("userData", path.join(__dirname, "../.tmp", entryName));
  if (root.endsWith('.asar')) {
    Object.defineProperty(app, 'isPackaged', { value: true });
    Object.defineProperty(process, 'resourcesPath', { value: path.dirname(root) });
  }
  // Default to isolated login-item storage so routine tests do not change Windows settings.
  const systemLoginItems = process.argv.includes('--system-login-items');
  if (!systemLoginItems) {
    let launchItems = [];
    app.getLoginItemSettings = () => ({ launchItems });
    app.setLoginItemSettings = options => {
      launchItems = launchItems.filter(item => item.name !== options.name);
      if (options.openAtLogin) launchItems.push({ name: options.name, scope: 'user', enabled: options.enabled, args: options.args });
    };
  }
  const Module = require("node:module");
  const main = new Module(path.join(root, "main.js"), module);
  main.filename = path.join(root, "main.js");
  main.paths = Module._nodeModulePaths(root);
  const originalRequire = main.require.bind(main);
  main.require = name => name === "electron" ? {
    ...electron,
    BrowserWindow: class extends BrowserWindow {
      constructor(options) { super({ ...options, show: false }); }
    },
  } : originalRequire(name);
  const code = fs.readFileSync(main.filename, "utf8")
    .replace('const startupEntryName = "line puppy";', `const startupEntryName = ${JSON.stringify(entryName)};`);
  main._compile(code + "\nmodule.exports = { getWindowsLoginOptions, repairWindowsLoginItem, buildUtilityMenu, getWindow: () => petWindow, getTray: () => tray, getListener: () => scrollListener, getMusicListener: () => musicListener };", main.filename);
  const api = main.exports;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const timeout = setTimeout(() => { console.error("Smoke test timed out"); app.quit(); process.exitCode = 1; }, 30000);
  app.whenReady().then(async () => {
    try {
      const mediaListener = api.getMusicListener();
      const mediaReady = new Promise((resolve, reject) => {
        mediaListener.stdout.on("data", data => { if (data.toString().includes("ready")) resolve(true); });
        mediaListener.on("error", reject);
        mediaListener.on("exit", code => reject(new Error(`Music listener exited: ${code}`)));
      });
      const listener = api.getListener();
      const ready = await new Promise((resolve, reject) => {
        listener.stdout.on("data", data => { if (data.toString().includes("ready")) resolve(true); });
        listener.on("error", reject);
        listener.on("exit", code => reject(new Error(`Listener exited: ${code}`)));
      });
      assert.equal(ready, true);
      assert.equal(await mediaReady, true);
      assert.equal(api.getTray().isDestroyed(), false);
      const menu = api.buildUtilityMenu(true);
      const startup = menu.find(item => item.type === "checkbox");
      assert.notEqual(startup.enabled, false);
      startup.click({ checked: true });
      const loginOptions = api.getWindowsLoginOptions();
      assert.equal(loginOptions.path, process.execPath);
      assert.deepEqual(loginOptions.args, app.isPackaged ? [] : [app.getAppPath()]);
      const startupItem = app.getLoginItemSettings(loginOptions).launchItems.find(item => item.name === entryName);
      assert.deepEqual(startupItem.args, loginOptions.args);
      assert.equal(api.buildUtilityMenu(true).find(item => item.type === "checkbox").checked, true);
      startup.click({ checked: false });
      assert.equal(api.buildUtilityMenu(true).find(item => item.type === "checkbox").checked, false);
      assert.equal(menu.at(-1).label, "退出");
      console.log(`PASS: native input registration, tray, startup enable/disable (${systemLoginItems ? 'Windows registry' : 'isolated storage'})`);

      const window = api.getWindow();
      if (window.webContents.isLoading()) await new Promise(resolve => window.webContents.once("did-finish-load", resolve));
      const evaluate = code => window.webContents.executeJavaScript(code);
      window.webContents.send("pet:music-state", "idle");
      await evaluate(`window.StartupDate = Date; window.Date = class extends StartupDate { getHours() { return 8; } getMinutes() { return 0; } }; void 0;`);
      assert.equal(await evaluate("currentState"), "startup");
      assert.equal(await evaluate("pet.complete && pet.naturalWidth === 240"), true);
      window.webContents.send("pet:scroll");
      await evaluate("hitArea.click()");
      await wait(500);
      assert.equal(await evaluate("currentState"), "startup");
      await wait(2600);
      assert.equal(await evaluate("currentState"), "default");
      console.log("PASS: startup GIF plays once, completes, and ignores early click/scroll");
      await evaluate(`window.RealDate = Date; window.Date = class extends RealDate { getHours() { return 12; } getMinutes() { return 15; } }; updateMealtime();`);
      assert.equal(await evaluate("currentState"), "mealtime");
      window.webContents.send("pet:scroll");
      await wait(400);
      assert.equal(await evaluate("currentState"), "scroll");
      assert.equal(await evaluate("pet.complete && pet.naturalWidth === 240"), true);
      await wait(1200);
      assert.equal(await evaluate("currentState"), "mealtime");
      window.webContents.send("pet:global-click", { x: -10000, y: -10000 });
      await wait(100);
      assert.equal(await evaluate("currentState"), "mealtime");
      await evaluate("document.body.click()");
      assert.equal(await evaluate("currentState"), "mealtime");
      await evaluate("hitArea.click()");
      assert.equal(await evaluate("currentState"), "click");
      await wait(1500);
      assert.equal(await evaluate("currentState"), "mealtime");
      await evaluate("window.Date = class extends RealDate { getHours() { return 13; } getMinutes() { return 0; } }; updateMealtime();");
      assert.equal(await evaluate("currentState"), "default");
      console.log("PASS: real Electron IPC, GIF loading, scroll completion, local-only click, meal schedule");
      for (const [effect, duration] of [["send", 1740], ["good", 2000], ["delete", 1840]]) {
        window.webContents.send("pet:keyboard-effect", { effect, pressed: true });
        await wait(100);
        assert.equal(await evaluate("currentState"), effect);
        assert.equal(await evaluate("pet.complete && pet.naturalWidth === 240"), true);
        window.webContents.send("pet:keyboard-effect", { effect, pressed: false });
        await wait(150);
        assert.equal(await evaluate("currentState"), effect);
        await wait(duration);
        assert.equal(await evaluate("currentState"), "default");
      }
      console.log("PASS: send/good/delete IPC and real GIF completion after key release");
      await evaluate(`window.ScheduledMinute = 20; window.Date = class extends RealDate { getHours() { return 17; } getMinutes() { return window.ScheduledMinute; } }; updateScheduledAnimations();`);
      await wait(2300);
      assert.equal(await evaluate("currentState"), "love520");
      assert.equal(await evaluate("pet.complete && pet.naturalWidth === 240"), true);
      await evaluate("window.ScheduledMinute = 21; updateScheduledAnimations()");
      await wait(2500);
      assert.equal(await evaluate("currentState"), "love521");
      assert.equal(await evaluate("pet.complete && pet.naturalWidth === 240"), true);
      await evaluate("window.ScheduledMinute = 22; updateScheduledAnimations()");
      assert.equal(await evaluate("currentState"), "default");
      console.log("PASS: 520/521 real GIFs loop past one cycle, switch by minute, and return to default");
      for (const [hour, state, asset] of [[23, 'sleep', 'sleepy.gif'], [0, 'sleep2', 'sleepy2.png'], [2, 'default', 'sleep.gif']]) {
        await evaluate(`window.Date = class extends RealDate { getHours() { return ${hour}; } getMinutes() { return 0; } }; updateScheduledAnimations();`);
        await wait(150);
        assert.equal(await evaluate('currentState'), state);
        assert.equal(await evaluate(`pet.complete && pet.naturalWidth > 0 && pet.src.endsWith(${JSON.stringify(asset)})`), true);
      }
      console.log('PASS: both night assets load and return to sleep.gif at 02:00');
      window.webContents.send("pet:music-state", "playing");
      await wait(1800);
      assert.equal(await evaluate("currentState"), "music");
      assert.equal(await evaluate("pet.complete && pet.naturalWidth === 240"), true);
      window.webContents.send("pet:music-state", "paused");
      await wait(100);
      assert.equal(await evaluate("currentState"), "default");
      window.webContents.send("pet:music-state", "playing");
      await wait(100);
      window.webContents.send("pet:music-state", "blocked");
      await wait(100);
      assert.equal(await evaluate("currentState"), "default");
      console.log("PASS: live Windows media API, music stops immediately on pause, and video exclusion IPC");
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      app.setLoginItemSettings({ ...api.getWindowsLoginOptions(), name: entryName, openAtLogin: false, enabled: false });
      clearTimeout(timeout);
      app.quit();
    }
  });
}
