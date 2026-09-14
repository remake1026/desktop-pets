# 开发说明

[返回首页](../README.md)

本项目使用 Electron、JavaScript、HTML 和 CSS。普通 Windows 用户直接下载首页安装包即可，无需配置开发环境。

## 源码运行

先安装 Node.js 和 npm，再下载或克隆本仓库。在项目根目录打开终端：

```bash
cd 源码
npm install
npm start
```

也可双击根目录的 `启动桌宠.cmd`（Windows）或 `启动桌宠.command`（macOS），脚本会在首次运行时安装依赖。

- 首次安装需要联网下载 Electron，耗时取决于网络。
- 提示找不到 `npm` 时，请确认已安装 Node.js，并重新打开终端。
- 启动失败时，在 `源码` 目录执行 `npm start` 查看错误输出。
- macOS 的透明区域支持点击穿透；应用在菜单栏提供“登录时启动”和“退出”，不显示程序坞图标。

## 任务完成动画

可在其他任务结束后调用以下命令，让小狗播放庆祝动画。

Windows 安装版（将路径替换为实际安装目录）：

```powershell
& "D:\线条小狗\线条小狗.exe" --task-complete
```

macOS 安装版：

```bash
"/Applications/线条小狗.app/Contents/MacOS/线条小狗" --task-complete
```

源码版，在 `源码` 目录执行：

```bash
npm run task-complete
```

## 构建安装包

在对应系统上，进入 `源码` 目录安装依赖：

```bash
npm ci
```

| 构建环境 | 命令 | 产物 |
| --- | --- | --- |
| Windows | `npm run dist:win` | Windows 10 / 11 安装包，包含 x86 / x64 程序 |
| Apple Silicon Mac | `npm run dist:mac` | arm64 的 `.app`、`.dmg` 和 `.zip` |

产物输出到项目根目录的 `dist/standard/`，文件名中的版本号来自 `源码/package.json`。

Windows 安装器支持中文界面、高 DPI、自选安装目录、桌面快捷方式和默认勾选的开机自启动，尚未进行代码签名。Mac 包采用 ad-hoc 签名，尚未进行 Apple 公证。

## macOS 与 Homebrew 发布

macOS 支持和 Cask 已合入，但截至本次文档更新（2026-09-14），本仓库尚未发布 v1.1.0 的 DMG；以下安装方式须等对应 Release 附件上传后才能使用。

当前 Cask 面向 Apple Silicon（arm64），要求 macOS Ventura 13 或更新版本，不提供 Intel Mac 预编译包。

发布时，将构建的 DMG 上传至对应 GitHub Release，并更新 `Casks/line-dog.rb` 的 `version` 与 `sha256`，确保下载地址、文件名和校验值一致。

发布完成后，已安装 Homebrew 的用户可执行：

```bash
brew tap remake1026/desktop-pets https://github.com/remake1026/desktop-pets
brew install --cask line-dog
```

`tap` 必须带完整仓库地址，因为本仓库名称不是 Homebrew 默认的 `homebrew-desktop-pets`。

也可从 [Releases](https://github.com/remake1026/desktop-pets/releases) 下载 DMG，打开后把“线条小狗”拖到“Applications”，再从“应用程序”启动。

升级与卸载：

```bash
brew upgrade --cask line-dog
brew uninstall --cask line-dog
```

卸载前如已开启“登录时启动”，先在应用菜单栏取消勾选。

## 主要源码

- `源码/main.js`：窗口、移动缩放、单实例和 macOS 菜单栏。
- `源码/pet.js`：鼠标互动、动画切换和任务完成反馈。
- `源码/index.html`、`源码/styles.css`：界面与样式。
