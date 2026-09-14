# 电脑桌面萌宠

![桌面萌宠预览](docs/images/readme-hero.png)

![秋日桌面预览](docs/images/readme-autumn.png)

一个基于 Electron 的桌面萌宠应用。小狗会悬浮在桌面上，可以拖拽移动、点击互动、调整大小，并支持通过命令触发任务完成动画。

**[下载 Windows 10 / 11 安装包（v1.0.3）](https://github.com/remake1026/desktop-pets/releases/download/v1.0.3/LineDog-1.0.3-Win10-11-Setup.exe)** · [版本说明](https://github.com/remake1026/desktop-pets/releases/tag/v1.0.3)

## 互动展示

从安静陪伴到鼠标互动，看看小狗的四种日常状态。

| 默认 | 鼠标悬停 | 鼠标点击 | 鼠标拖拽 |
| :---: | :---: | :---: | :---: |
| <img src="源码/assets/sleep.gif" width="180" alt="默认状态：小狗睡觉动画" /> | <img src="源码/assets/jump.gif" width="180" alt="鼠标悬停：小狗跳跃动画" /> | <img src="源码/assets/heart.gif" width="180" alt="鼠标点击：小狗爱心动画" /> | <img src="源码/assets/special.gif" width="180" alt="鼠标拖拽：小狗拖拽动画" /> |
| 不操作时，小狗安静地睡觉，陪伴在桌面上。 | 将鼠标移到小狗身上，小狗会跳跃回应；移开后恢复默认状态。 | 鼠标左键点击小狗，播放爱心动画；播放结束后恢复默认状态。 | 按住鼠标左键并移动，小狗切换为拖拽动画，跟随鼠标移动位置；松开后停在新位置。 |

## 功能

- 桌面悬浮：无边框、透明背景、置顶显示
- 原生 GIF 动画：睡觉、悬停、点击、拖拽、任务完成等状态
- 鼠标互动：悬停跳跃，点击出现爱心动画
- 拖拽移动：按住小狗即可移动位置
- 缩放调节：悬停后拖动右下角旋钮调整大小
- 快捷关闭：右键呼出关闭按钮
- 单实例运行：重复启动时复用已有窗口
- 开机自启动：Windows 安装时可选择登录后自动启动；macOS 可在菜单栏图标中勾选“登录时启动”
- 任务完成反馈：使用启动参数播放庆祝动画
- macOS 适配：透明置顶、点击穿透空白区域、菜单栏退出、不占用程序坞

## 技术栈

- Electron
- JavaScript
- HTML
- CSS
- Node.js / npm

## 小白安装教程

下面的步骤适合没有开发经验的 Windows 用户。

### 使用 Windows 安装包（无需安装 Node.js）

当前仅提供 Windows 10 / 11 安装包，已包含运行环境，无需安装 Node.js，安装时也无需联网下载依赖。

| 安装包 | 目标系统 | 架构 |
| --- | --- | --- |
| [下载 v1.0.3 安装包](https://github.com/remake1026/desktop-pets/releases/download/v1.0.3/LineDog-1.0.3-Win10-11-Setup.exe)（约 180 MB） | Windows 10、Windows 11 | 自动选择 x86 / x64 |

1. 点击上面的下载链接，保存 `LineDog-1.0.3-Win10-11-Setup.exe`。也可进入 [Releases 页面](https://github.com/remake1026/desktop-pets/releases/tag/v1.0.3)，在 **Assets** 中下载 `.exe` 安装包；`Source code` 是源码压缩包。
2. 如果旧版小狗正在运行，先右键小狗并点击“关闭萌宠”，再双击安装包。
3. 选择“仅为我安装”，点击“下一步”。需要为这台电脑的所有用户安装时，可选择“所有用户”。
4. 在“选定安装位置”页输入目录或点击“浏览”，可以选择其他磁盘，默认应用文件夹名为“线条小狗”。
5. 在“安装选项”页设置 **创建桌面快捷方式** 和 **开机自动启动**。两个选项默认勾选，不需要时可取消。
6. 点击“安装”。完成后保留“运行线条小狗”的勾选并点击“完成”，小狗就会出现在桌面上。以后可以从桌面快捷方式或开始菜单启动。

- 安装路径可以改为其他磁盘上的文件夹，支持中文路径。
- 默认安装文件夹和主程序名称为“线条小狗”，卸载程序为“卸载线条小狗.exe”。
- “创建桌面快捷方式”和“开机自动启动”均默认勾选，可在安装时取消；自启动会在登录 Windows 后启动小狗，卸载时清理对应设置。
- 默认仅为当前用户安装；也可以选择为所有用户安装，此时可能需要管理员授权。
- 卸载时，在 Windows 的应用列表中找到“线条小狗”即可。

当前已在 Windows 10 上进行程序运行测试，Windows 11 尚未完成实机验证；暂不提供其他 Windows 版本或原生 ARM64 安装包。安装包尚未进行代码签名，Windows 可能显示“未知发布者”。

### 使用 macOS 安装包（Apple Silicon，无需安装 Node.js）

当前提供 Apple Silicon 的 macOS 安装包，已包含运行环境，无需安装 Node.js，也无需联网下载依赖。推荐用 [Homebrew](https://brew.sh) 安装。

| 安装包 | 目标系统 | 架构 |
| --- | --- | --- |
| Homebrew Cask `line-dog`，或 [下载 v1.1.0 DMG](https://github.com/remake1026/desktop-pets/releases/download/v1.1.0/LineDog-1.1.0-Mac-arm64.dmg)（约 113 MB） | macOS Ventura 13 或更新 | Apple Silicon（arm64） |

1. 已安装 Homebrew 时，打开「终端」执行：

```bash
brew tap remake1026/desktop-pets https://github.com/remake1026/desktop-pets
brew install --cask line-dog
```

本仓库名是 `desktop-pets`，不是 Homebrew 默认的 `homebrew-desktop-pets`，所以 tap 时要写完整 GitHub 地址。

2. 没有 Homebrew 时，下载 `LineDog-1.1.0-Mac-arm64.dmg`，双击后将 **线条小狗** 拖到 **Applications**。
3. 打开「访达 → 应用程序」，双击 **线条小狗**。小狗会出现在桌面右下角附近，菜单栏右侧会出现图标。
4. 如果系统提示“无法打开，因为无法验证开发者”：按住 Control 再点击应用，选择“打开”，或在终端执行：

```bash
xattr -cr /Applications/线条小狗.app
```

然后再打开一次。当前 Mac 包使用 ad-hoc 签名，尚未进行 Apple 公证，所以会有这层提示。

- 菜单栏图标可以勾选 **登录时启动**，也可以 **退出**。
- 右键点击小狗仍可显示“关闭萌宠”。
- 透明区域会把鼠标点击交给下面的桌面或窗口，不会挡住操作。
- 仅支持 Apple Silicon（arm64）。Intel Mac 需要在对应机器上自行构建，或后续再提供 x64 / Universal 包。
- Homebrew 升级：`brew upgrade --cask line-dog`。卸载：`brew uninstall --cask line-dog`，或把「应用程序」里的「线条小狗」移到废纸篓。

### 源码运行方式一：启动脚本

下面的方式适合需要从源码运行的用户，需先安装 Node.js；使用上面的安装包可以跳过本节。

1. 下载或克隆本项目到电脑本地。
2. 确认电脑已经安装 Node.js。
3. Windows 双击项目根目录下的 `启动桌宠.cmd`；macOS 双击 `启动桌宠.command`（若系统询问，选择“打开”）。
4. 第一次运行时，脚本会自动安装依赖，等待安装完成即可。
5. 安装完成后，线条小狗会自动出现在桌面右下角附近。

如果双击后窗口一闪而过，通常是没有安装 Node.js，或者 npm 命令不可用。请先安装 Node.js，然后重新打开脚本。

### 源码运行方式二：命令行

如果你想看到更清楚的安装过程，可以按下面步骤操作。

1. 在项目文件夹空白处按住 `Shift`，点击鼠标右键。
2. 选择“在终端中打开”或“在 PowerShell 中打开”。
3. 进入源码目录：

```powershell
cd 源码
```

macOS 终端：

```bash
cd 源码
```

4. 安装依赖：

```bash
npm install
```

5. 启动桌宠：

```bash
npm start
```

### 触发任务完成动画

安装版可以在 PowerShell 中执行以下命令，将路径替换为实际安装目录：

```powershell
& "D:\线条小狗\线条小狗.exe" --task-complete
```

如果是从源码运行，可以在 `源码` 目录执行：

```bash
npm run task-complete
```

macOS 安装版可以执行：

```bash
"/Applications/线条小狗.app/Contents/MacOS/线条小狗" --task-complete
```

桌宠会播放任务完成反馈动画。

## 使用方法

- 默认状态：小狗安静地睡觉，陪伴在桌面上
- 鼠标移到小狗身上：小狗会跳跃
- 鼠标左键点击小狗：播放爱心互动动画
- 按住小狗拖动：移动桌宠位置
- 鼠标移到小狗附近：右下角会出现缩放旋钮，拖动可调整大小
- 鼠标右键点击小狗：显示关闭按钮
- 开机自动启动：Windows 安装时勾选后，登录即可自动启动；需要修改时可重新运行安装包，在“安装选项”页调整。macOS 点击菜单栏图标，勾选或取消“登录时启动”
- 卸载：在 Windows 的应用列表中卸载“线条小狗”，或运行安装目录中的“卸载线条小狗.exe”；卸载会清理该安装对应的自启动项。macOS 把应用程序里的“线条小狗”移到废纸篓即可；若开启过登录启动，先在菜单栏取消勾选

## 常见问题

### 提示 npm 不是内部或外部命令

说明电脑还没有安装 Node.js，或者安装后没有重启终端。

处理方法：

1. 安装 Node.js。
2. 关闭当前 PowerShell 或命令窗口。
3. 重新打开窗口，再运行 `启动桌宠.cmd` 或 `npm install`。

### 第一次启动很慢

从源码首次运行时需要下载 Electron 依赖，耗时和网络有关。安装包已包含运行环境，无需这一步。

### 桌宠没有出现

可以尝试：

- 查看任务栏或后台是否已经运行了一个实例
- macOS 可重新双击「应用程序」里的线条小狗，或再执行一次 `brew reinstall --cask line-dog`
- 重新双击 `启动桌宠.cmd` 或 `启动桌宠.command`
- 在 `源码` 目录运行 `npm start`，查看命令行是否有报错

### 怎么关闭桌宠

右键点击小狗，出现关闭按钮后点击即可关闭。macOS 也可以点击菜单栏右侧的小狗图标，选择“退出”。

### macOS 提示无法验证开发者

Mac 包尚未 Apple 公证。按住 Control 再点击应用选择“打开”，或执行 `xattr -cr /Applications/线条小狗.app` 后再启动。

## 目录结构

```text
.
├── 启动桌宠.cmd
├── 启动桌宠.command
├── Casks/
│   └── line-dog.rb
├── heart.gif
├── jump.gif
├── sleep.gif
├── special.gif
├── usageOver3Hours.gif
├── docs/
│   └── images/
│       ├── readme-hero.png
│       └── readme-autumn.png
├── 快捷方式图标/
└── 源码/
    ├── assets/
    ├── installer-resources/
    ├── index.html
    ├── main.js
    ├── package.json
    ├── pet.js
    ├── preload.js
    └── styles.css
```

## 开发说明

### 构建 Windows 安装包

在 Windows 开发电脑的 `源码` 目录中执行：

```powershell
npm ci
npm run dist:win
```

安装包输出到项目根目录的 `dist/standard/`，包含 32 位和 64 位程序，安装器按系统架构自动选择。

安装器使用 NSIS 中文向导和微软雅黑 UI 字体，启用高 DPI 支持、自选安装目录、桌面快捷方式、开始菜单入口和卸载功能。试用安装包尚未进行代码签名。

### 构建 macOS 安装包

在 Apple Silicon Mac 的 `源码` 目录中执行：

```bash
npm ci
npm run dist:mac
```

产物输出到项目根目录的 `dist/standard/`，包括 `线条小狗.app`、`LineDog-1.1.0-Mac-arm64.dmg` 和对应 zip。构建机上会做 ad-hoc 签名，便于本地打开；分发给其他人时 macOS 仍可能提示未验证开发者。

发布新的 Mac 包后，请把它挂到本仓库对应的 GitHub Release，并更新 `Casks/line-dog.rb` 中的 `version` 与 `sha256`，这样 `brew upgrade --cask line-dog` 才能拿到新版本。

本仓库可以直接当作 Homebrew tap 使用。`brew tap remake1026/desktop-pets` 默认会去找 `remake1026/homebrew-desktop-pets`，所以必须带上完整地址：

```bash
brew tap remake1026/desktop-pets https://github.com/remake1026/desktop-pets
```

如果之后单独建了名为 `homebrew-desktop-pets` 的仓库，就可以写成 `brew install --cask remake1026/desktop-pets/line-dog`。

### 源码结构

主进程逻辑位于 `源码/main.js`，负责创建透明置顶窗口、处理窗口移动和缩放。

桌宠交互逻辑位于 `源码/pet.js`，负责切换不同 GIF 状态、处理鼠标悬停、点击、拖拽、关闭和任务完成反馈。

界面结构和样式分别位于 `源码/index.html` 与 `源码/styles.css`。

## Git 忽略

仓库已忽略 `node_modules/`、构建产物、日志、缓存、编辑器配置和系统文件。提交代码时保留源码、资源文件、`package.json` 与 `package-lock.json` 即可。

## 关于素材与版权

这个项目是出于对「线条小狗」的喜爱，以及学习和交流桌面应用开发的目的制作的。

项目中使用的相关图片和 GIF 动画来自网络流传的表情包，目前尚未获得原作者或相关权利人的授权，素材版权归各自权利人所有。本项目并非官方作品，也与原作者不存在合作或授权关系。

欢迎交流代码和实现思路，但仓库公开并不代表其中的表情包素材可以自由使用。请勿将这些素材用于商业用途；如需在其他项目中使用或传播，请先确认并取得相关授权。学习交流的初衷也不能替代素材授权。

如果您是相关素材的权利人，觉得这里的使用不合适，请通过 [Issues] 联系我，我会及时处理，删除或替换相关素材。

感谢原作者带来这么可爱的作品，也希望大家一起尊重创作、支持正版。
