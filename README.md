# Simple Todo List

**English** | [中文](#简单待办清单)

A clean todo list and planning board plugin for [Obsidian](https://obsidian.md). It is designed for quick capture, day-based planning, drag-and-drop organization, and lightweight notes without leaving your vault.

![Main view](assets/总览.png)

## Features

- **Task management**: create tasks with title, note, due date, and priority.
- **Right sidebar entry**: open the todo view directly in Obsidian's right sidebar.
- **Planning zones**: create date-based zones and arrange tasks by day or custom labels.
- **Drag and drop**: drag tasks into zones, reorder tasks inside a zone, and reorder zones by dragging their headers.
- **Resizable layout**: resize the task list and planning board with the middle divider.
- **Resizable zones**: drag a zone card's bottom-right handle to persist its size.
- **Note viewer**: open task notes from a sticky-note icon; task rows stay compact.
- **Search**: filter tasks by title or note in real time.
- **Completed bin**: complete, restore, permanently delete, or clear completed tasks.
- **Local data**: plugin data is stored in Obsidian's plugin `data.json` inside your vault.

## Usage

1. Click the ribbon icon to open **Simple Todo List** in the right sidebar.
2. Click **+ Task** to create a task.

   ![Add task](assets/新建任务.jpg)

3. Click **+ Zone** to create a planning zone.

   ![Add zone](assets/新建分区.png)

4. Drag tasks from the left task list into zones on the right.
5. Drag tasks inside a zone to reorder them freely.
6. Drag the divider between the task list and board to adjust panel width.
7. Drag the bottom-right handle of a zone card to resize that zone.
8. Click the sticky-note icon to view a task's note.

## Tech Stack

- **Obsidian Plugin API**: view registration, ribbon icon, commands, settings tab, modal dialogs, persistent plugin data.
- **TypeScript**: main source code, typed task/zone/settings models, strict null checks.
- **DOM API**: direct rendering with Obsidian-compatible `createDiv`, `createEl`, event listeners, and drag/pointer events.
- **HTML Drag and Drop API**: task assignment, task reordering inside zones, and zone reordering.
- **Pointer Events**: custom resize handles for the task/board divider and individual zone cards.
- **Obsidian `moment`**: due-date formatting and relative date display.
- **Lucide icons via Obsidian `setIcon`**: checkboxes and note icons.
- **CSS**: responsive two-panel layout, wrapping zone board, compact task rows, hover actions, and modal styling.
- **esbuild**: bundles `main.ts` into `main.js`.
- **TypeScript compiler**: validates types before production builds.

## Project Structure

```text
.
├── main.ts              # Plugin source code
├── main.js              # Bundled Obsidian entry file
├── styles.css           # Plugin styles
├── manifest.json        # Obsidian plugin manifest
├── package.json         # npm scripts and dev dependencies
├── package-lock.json    # Locked npm dependency versions for reproducible installs
├── esbuild.config.mjs   # Build configuration
├── tsconfig.json        # TypeScript configuration
└── assets/              # README screenshots
```

## Development

Install dependencies:

```bash
npm install
```

Start watch mode:

```bash
npm run dev
```

Build production files:

```bash
npm run build
```

The build command runs TypeScript checks first, then bundles `main.ts` to `main.js` with esbuild.

## Manual Installation

Copy these files into your vault plugin folder:

```text
<your-vault>/.obsidian/plugins/simple-todo-list/
├── main.js
├── styles.css
└── manifest.json
```

Then enable **Simple Todo List** in Obsidian Settings -> Community plugins.

When updating manually, do not delete or overwrite `data.json` in the plugin folder if you want to keep existing tasks and notes.

## Data Model

Plugin data is saved by Obsidian as JSON. The main settings include:

- `todos`: active tasks.
- `trash`: completed tasks.
- `boardZones`: planning zones, zone order, task order inside each zone, and saved zone sizes.
- `todoPanelWidth`: saved width for the left task panel.

## Author

**Selene Su** - [GitHub](https://github.com/SuMeidan)

## License

MIT

---

# 简单待办清单

[English](#simple-todo-list) | **中文**

一个简洁的 [Obsidian](https://obsidian.md) 待办清单与规划板插件。它适合快速记录任务、按日期规划、拖拽整理任务，并通过轻量备注保存上下文。

![主界面](assets/总览.png)

## 功能特性

- **任务管理**：支持标题、备注、截止日期和优先级。
- **右侧边栏入口**：点击插件图标后，待办视图会打开在 Obsidian 右侧边栏。
- **规划分区**：创建日期分区，也可以设置自定义标题。
- **拖拽整理**：任务可拖入分区，分区内任务可自由排序，分区本身也可拖拽排序。
- **栏宽可调**：任务栏和分区栏之间的分隔条可拖动，宽度会保存。
- **分区大小可调**：拖动分区右下角手柄调整大小，刷新后仍保留。
- **备注查看**：通过便签图标查看备注，任务列表保持简洁。
- **实时搜索**：按任务标题或备注内容即时过滤。
- **已完成箱**：完成、恢复、永久删除或清空已完成任务。
- **本地保存**：数据保存在当前 Obsidian 库的插件 `data.json` 中。

## 使用方法

1. 点击 Obsidian 左侧功能区的插件图标，在右侧边栏打开待办清单。
2. 点击 **+ 任务** 新建待办事项。

   ![新建任务](assets/新建任务.jpg)

3. 点击 **+ 分区** 创建规划分区。

   ![新建分区](assets/新建分区.png)

4. 将左侧任务拖到右侧分区中。
5. 在分区内部拖动任务，可自由调整顺序。
6. 拖动任务栏和分区栏之间的分隔条，可调整左右区域大小。
7. 拖动分区卡片右下角手柄，可调整单个分区大小。
8. 点击便签图标查看任务备注。

## 技术栈

- **Obsidian Plugin API**：注册自定义视图、左侧功能区图标、命令、设置页、弹窗和插件持久化数据。
- **TypeScript**：主要开发语言，定义任务、分区、设置等数据结构，并启用严格空值检查。
- **DOM API**：使用 Obsidian 兼容的 `createDiv`、`createEl` 和事件监听直接渲染界面。
- **HTML Drag and Drop API**：实现任务拖入分区、分区内任务排序、分区排序。
- **Pointer Events**：实现任务栏/分区栏宽度调整，以及分区卡片大小调整。
- **Obsidian `moment`**：处理截止日期、相对日期和日期格式化。
- **Obsidian `setIcon` / Lucide 图标**：用于复选框、备注入口等图标按钮。
- **CSS**：实现双栏布局、分区自动换行、紧凑任务行、悬浮操作按钮和弹窗样式。
- **esbuild**：将 `main.ts` 打包为 Obsidian 使用的 `main.js`。
- **TypeScript Compiler**：在构建前进行类型检查。

## 项目结构

```text
.
├── main.ts              # 插件源代码
├── main.js              # 打包后的 Obsidian 入口文件
├── styles.css           # 插件样式
├── manifest.json        # Obsidian 插件清单
├── package.json         # npm 脚本与开发依赖
├── package-lock.json    # npm 依赖锁定文件，保证安装和 CI 构建可复现
├── esbuild.config.mjs   # 构建配置
├── tsconfig.json        # TypeScript 配置
└── assets/              # README 截图资源
```

## 开发与构建

安装依赖：

```bash
npm install
```

开发监听：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

`npm run build` 会先执行 TypeScript 类型检查，再使用 esbuild 将 `main.ts` 打包成 `main.js`。

## 手动安装

将以下文件复制到你的 Obsidian 库插件目录：

```text
<你的库>/.obsidian/plugins/simple-todo-list/
├── main.js
├── styles.css
└── manifest.json
```

然后在 Obsidian 设置 -> 第三方插件中启用 **Simple Todo List**。

手动更新时，如果想保留已有任务和备注，不要删除或覆盖插件目录中的 `data.json`。

## 数据说明

插件数据由 Obsidian 保存为 JSON，主要字段包括：

- `todos`：未完成任务。
- `trash`：已完成任务。
- `boardZones`：规划分区、分区顺序、分区内任务顺序和分区尺寸。
- `todoPanelWidth`：左侧任务栏保存的宽度。

## 作者

**Selene Su** - [GitHub](https://github.com/SuMeidan)

## 许可证

MIT
