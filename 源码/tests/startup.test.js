const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function fixture(items = [], packaged = false) {
  const writes = [];
  const app = {
    isPackaged: packaged,
    getAppPath: () => 'C:\\Pets with spaces\\source',
    disableHardwareAcceleration() {}, setAppUserModelId() {},
    requestSingleInstanceLock: () => false, quit() {},
    getLoginItemSettings: () => ({ launchItems: items }),
    setLoginItemSettings: options => writes.push(options),
  };
  const context = vm.createContext({
    require: name => name === 'electron' ? { app, ipcMain: { on() {}, handle() {} } } : require(name),
    process: { platform: 'win32', execPath: 'C:\\Pets with spaces\\line puppy.exe', argv: [] },
    __dirname: path.resolve(__dirname, '..'),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8'), context);
  return { writes, run: code => vm.runInContext(code, context) };
}

test('login arguments retain spaces without embedding literal double quotes', () => {
  for (const packaged of [false, true]) {
    const f = fixture([], packaged);
    const options = JSON.parse(JSON.stringify(f.run('getWindowsLoginOptions()')));
    assert.equal(options.path, 'C:\\Pets with spaces\\line puppy.exe');
    assert.deepEqual(options.args, packaged ? [] : ['C:\\Pets with spaces\\source']);
  }
});

test('legacy startup name migrates without changing the disabled choice', () => {
  const oldName = String.fromCodePoint(0x7ebf, 0x6761, 0x5c0f, 0x72d7);
  const f = fixture([{ name: oldName, scope: 'user', enabled: false, args: ['"C:\\Pets with spaces\\source"'] }]);
  f.run('repairWindowsLoginItem()');
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[0].name, 'line puppy');
  assert.equal(f.writes[0].enabled, false);
  assert.equal(f.writes[0].openAtLogin, true);
  assert.equal(f.writes[0].args[0], 'C:\\Pets with spaces\\source');
  assert.equal(f.writes[1].name, oldName);
  assert.equal(f.writes[1].openAtLogin, false);
});

test('correct and absent startup items do not cause registry writes', () => {
  for (const items of [[], [{ name: 'line puppy', scope: 'user', enabled: true, args: ['C:\\Pets with spaces\\source'] }]]) {
    const f = fixture(items);
    f.run('repairWindowsLoginItem()');
    assert.equal(f.writes.length, 0);
  }
});

test('unrelated and machine startup entries are not migrated', () => {
  const f = fixture([{ name: 'unrelated', scope: 'user', args: [] },
    { name: String.fromCodePoint(0x7ebf, 0x6761, 0x5c0f, 0x72d7), scope: 'machine', args: [] }]);
  f.run('repairWindowsLoginItem()');
  assert.equal(f.writes.length, 0);
});
