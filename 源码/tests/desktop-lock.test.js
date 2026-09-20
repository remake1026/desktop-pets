const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Loads main.js in an isolated context with a stubbed electron module. The
// single-instance lock is refused so the whenReady branch (window/tray/native
// listeners) never runs; only the pure menu/settings logic is exercised.
function fixture(items = []) {
  const writes = [];
  const noop = () => {};
  const app = {
    isPackaged: false,
    getAppPath: () => 'C:\\Pets with spaces\\source',
    disableHardwareAcceleration: noop,
    setAppUserModelId: noop,
    requestSingleInstanceLock: () => false,
    quit: noop,
    getLoginItemSettings: () => ({ launchItems: items }),
    setLoginItemSettings: options => writes.push(options),
    getPath: () => path.join(__dirname, '../.tmp/desktop-lock-test/settings.json'),
  };
  const context = vm.createContext({
    require: name => name === 'electron'
      ? { app, ipcMain: { on: noop, handle: noop } }
      : require(name),
    process: { platform: 'win32', execPath: 'C:\\Pets with spaces\\line puppy.exe', argv: [] },
    __dirname: path.resolve(__dirname, '..'),
    console: { log: noop, error: noop, warn: noop },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8'), context);
  return { writes, run: code => vm.runInContext(code, context) };
}

const LOCK_LABEL = '锁定桌面（鼠标穿透）';

test('tray menu exposes an unlocked desktop-lock checkbox by default', () => {
  const f = fixture();
  const lock = f.run('buildUtilityMenu(true)').find(item => item.label === LOCK_LABEL);
  assert.ok(lock, 'lock item is present');
  assert.equal(lock.type, 'checkbox');
  assert.equal(lock.checked, false);
  assert.equal(f.run('desktopLocked'), false);
});

test('toggling the desktop-lock checkbox updates state and the reopened menu', () => {
  const f = fixture();
  const lock = f.run('buildUtilityMenu(true)').find(item => item.label === LOCK_LABEL);
  lock.click({ checked: true });
  assert.equal(f.run('desktopLocked'), true);
  assert.equal(f.run('buildUtilityMenu(true)').find(i => i.label === LOCK_LABEL).checked, true);
  lock.click({ checked: false });
  assert.equal(f.run('desktopLocked'), false);
  assert.equal(f.run('buildUtilityMenu(true)').find(i => i.label === LOCK_LABEL).checked, false);
});

test('desktop-lock does not disturb the startup checkbox or the trailing quit item', () => {
  const f = fixture();
  const menu = f.run('buildUtilityMenu(true)');
  assert.equal(menu.find(item => item.type === 'checkbox').label, '开机自启动');
  assert.equal(menu.at(-1).label, '退出');
});
