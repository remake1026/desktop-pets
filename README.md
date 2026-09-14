# 电脑桌面萌宠

![桌面萌宠预览](docs/images/readme-hero.png)

![秋日桌面预览](docs/images/readme-autumn.png)

让线条小狗陪在桌面上，支持鼠标互动、拖拽移动和大小调节。

**[下载 Windows 10 / 11 安装包 · v1.0.3](https://github.com/remake1026/desktop-pets/releases/download/v1.0.3/LineDog-1.0.3-Win10-11-Setup.exe)**（约 180 MB） · [版本说明](https://github.com/remake1026/desktop-pets/releases/tag/v1.0.3)

macOS 支持已合入源码，安装包尚未发布；可先[从源码运行](docs/development.md#源码运行)，后续安装包见 [Releases](https://github.com/remake1026/desktop-pets/releases)。

## 互动展示

| 默认 | 鼠标悬停 | 鼠标点击 | 鼠标拖拽 |
| :---: | :---: | :---: | :---: |
| <img src="源码/assets/sleep.gif" width="180" alt="默认：小狗睡觉" /> | <img src="源码/assets/jump.gif" width="180" alt="鼠标悬停：小狗跳跃" /> | <img src="源码/assets/heart.gif" width="180" alt="鼠标点击：爱心动画" /> | <img src="源码/assets/special.gif" width="180" alt="鼠标拖拽：移动小狗" /> |
| 安静睡觉，陪伴桌面 | 移到小狗身上，跳跃回应 | 左键点击，播放爱心动画 | 按住左键拖动，移动位置 |

## 安装

Windows 安装包自带运行环境，无需安装 Node.js。

1. 下载上方安装包并双击打开；更新旧版前，先关闭正在运行的小狗。
2. 按向导选择安装路径。**桌面快捷方式**和**开机自动启动**默认勾选，不需要可取消。
3. 点击“安装”，完成后运行“线条小狗”。以后可从桌面快捷方式或开始菜单启动。

适用于 Windows 10 / 11，自动选择 32 / 64 位程序。已在 Windows 10 测试，Windows 11 尚未实机验证；暂不提供原生 ARM64 安装包。

## 使用

- **调整大小**：鼠标移到小狗附近，拖动右下角旋钮。
- **关闭**：右键小狗，点击“关闭萌宠”；macOS 也可从菜单栏图标选择“退出”。
- **自启动**：Windows 重新运行安装包即可调整；macOS 在菜单栏图标中勾选或取消“登录时启动”。

<details>
<summary>常见问题与卸载</summary>

**提示“未知发布者”？** Windows 安装包尚未进行代码签名，请核对下载来源为本仓库的 Releases。

**小狗没有出现？** 尝试从桌面快捷方式或开始菜单重新打开；macOS 从原来的启动入口重试。仍有问题时，请在 [Issues](https://github.com/remake1026/desktop-pets/issues) 中附上系统版本和问题截图。

**如何卸载？** Windows 在系统应用列表中卸载“线条小狗”，会同时清理对应自启动项。macOS 安装版先取消“登录时启动”，再把应用移到废纸篓；通过 Homebrew 安装的可执行 `brew uninstall --cask line-dog`。

</details>

<details>
<summary>源码运行、打包与进阶用法</summary>

请看[开发说明](docs/development.md)，包含源码启动、Windows / macOS 打包、Homebrew 发布和任务完成动画命令。

</details>

<details>
<summary>关于素材与版权</summary>

这个项目是出于对「线条小狗」的喜爱，以及学习和交流桌面应用开发的目的制作的。

项目中使用的相关图片和 GIF 动画来自网络流传的表情包，目前尚未获得原作者或相关权利人的授权，素材版权归各自权利人所有。本项目并非官方作品，也与原作者不存在合作或授权关系。

欢迎交流代码和实现思路，但仓库公开并不代表其中的表情包素材可以自由使用。请勿将这些素材用于商业用途；如需在其他项目中使用或传播，请先确认并取得相关授权。学习交流的初衷也不能替代素材授权。

如果您是相关素材的权利人，觉得这里的使用不合适，请通过 [Issues](https://github.com/remake1026/desktop-pets/issues) 联系我，我会及时处理，删除或替换相关素材。

感谢原作者带来这么可爱的作品，也希望大家一起尊重创作、支持正版。

</details>
