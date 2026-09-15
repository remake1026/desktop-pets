// 本机构建辅助配置：使用预解压的 Electron 目录，避免在线解压大 zip 后
// 目录重命名被杀毒软件/索引服务占用导致 EPERM。
// 使用方法：
//   1. 将 electron-v<version>-win32-x64.zip / electron-v<version>-win32-ia32.zip
//      分别解压到 <项目根>/.cache/electron-dist/unpacked-x64 和 unpacked-ia32
//   2. electron-builder --win nsis --x64 --ia32 --publish never --config builder-fix.config.cjs
const path = require("path");
const pkg = require("./package.json");

const projectRoot = path.resolve(__dirname, "..");
const electronBase = path.join(projectRoot, ".cache", "electron-dist");

module.exports = {
  ...pkg.build,
  directories: {
    ...pkg.build.directories,
    output: path.join(projectRoot, "dist", "build-fix"),
  },
  electronDist: (options) => {
    const a = String(options && options.arch).toLowerCase();
    const dir = /ia32|x86|^0$/.test(a) ? "unpacked-ia32" : "unpacked-x64";
    return path.join(electronBase, dir);
  },
};
