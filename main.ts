import {
  App,
  ItemView,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
  Modal,
  moment,
} from "obsidian";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Priority = "high" | "medium" | "low";

export interface TodoItem {
  id: string;
  title: string;
  note: string;
  dueDate: string | null;
  priority: Priority;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

export interface BoardZone {
  id: string;
  date: string;      // "YYYY-MM-DD"
  label: string;
  todoIds: string[];
  order: number;     // for drag-reorder of zones
}

export interface TodoSettings {
  todos: TodoItem[];
  trash: TodoItem[];
  boardZones: BoardZone[];
}

const DEFAULT_SETTINGS: TodoSettings = { todos: [], trash: [], boardZones: [] };
export const VIEW_TYPE_TODO = "simple-todo-view";

const PRIORITY_LABELS: Record<Priority, string> = { high: "高", medium: "中", low: "低" };
const PRIORITY_ORDER:  Record<Priority, number>  = { high: 0,   medium: 1,   low: 2   };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const today = moment().startOf("day");
  const due   = moment(dateStr, "YYYY-MM-DD");
  const diff  = due.diff(today, "days");
  if (diff < 0)   return `逾期 ${Math.abs(diff)} 天`;
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff <= 7)  return `${diff} 天后`;
  return due.format("MM/DD");
}

function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return moment(dateStr, "YYYY-MM-DD").diff(moment().startOf("day"), "days") <= 1;
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return moment(dateStr, "YYYY-MM-DD").diff(moment().startOf("day"), "days") < 0;
}

function formatZoneHeader(zone: BoardZone): string {
  if (zone.label) return zone.label;
  const diff = moment(zone.date, "YYYY-MM-DD").diff(moment().startOf("day"), "days");
  if (diff === 0)  return "今天";
  if (diff === 1)  return "明天";
  if (diff === -1) return "昨天";
  if (diff > 1 && diff <= 6) return moment(zone.date, "YYYY-MM-DD").format("ddd");
  return moment(zone.date, "YYYY-MM-DD").format("M月D日");
}

// ─── TodoModal ────────────────────────────────────────────────────────────────

class TodoModal extends Modal {
  private item: Partial<TodoItem>;
  private onSubmit: (item: Partial<TodoItem>) => void;
  private isEdit: boolean;

  constructor(app: App, item: Partial<TodoItem>, onSubmit: (item: Partial<TodoItem>) => void, isEdit = false) {
    super(app);
    this.item = { ...item };
    this.onSubmit = onSubmit;
    this.isEdit = isEdit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("todo-modal");
    contentEl.createEl("h2", { text: this.isEdit ? "编辑事项" : "新建事项", cls: "todo-modal-title" });

    const mkField = (label: string) => {
      const w = contentEl.createDiv("todo-modal-field");
      w.createEl("label", { text: label, cls: "todo-modal-label" });
      return w;
    };

    const titleInput = mkField("事项内容").createEl("input", {
      type: "text", cls: "todo-modal-input", placeholder: "要做什么？",
    });
    titleInput.value = this.item.title ?? "";
    titleInput.focus();

    const noteInput = mkField("备注（可选）").createEl("textarea", {
      cls: "todo-modal-textarea", placeholder: "添加备注...",
    });
    noteInput.value = this.item.note ?? "";

    const dateInput = mkField("截止日期（可选）").createEl("input", { type: "date", cls: "todo-modal-input" });
    dateInput.value = this.item.dueDate ?? "";

    const prioSelect = mkField("优先级").createEl("select", { cls: "todo-modal-select" });
    (["high", "medium", "low"] as Priority[]).forEach((p) => {
      const opt = prioSelect.createEl("option", { value: p, text: PRIORITY_LABELS[p] });
      if ((this.item.priority ?? "medium") === p) opt.selected = true;
    });

    const btnRow = contentEl.createDiv("todo-modal-buttons");
    btnRow.createEl("button", { text: "取消", cls: "todo-modal-btn todo-modal-btn-cancel" })
      .addEventListener("click", () => this.close());

    const submit = () => {
      const title = titleInput.value.trim();
      if (!title) { titleInput.addClass("todo-input-error"); titleInput.focus(); return; }
      this.onSubmit({ title, note: noteInput.value.trim(), dueDate: dateInput.value || null, priority: prioSelect.value as Priority });
      this.close();
    };
    btnRow.createEl("button", { text: this.isEdit ? "保存" : "添加", cls: "todo-modal-btn todo-modal-btn-submit" })
      .addEventListener("click", submit);
    titleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }

  onClose() { this.contentEl.empty(); }
}

// ─── ZoneModal ────────────────────────────────────────────────────────────────

class ZoneModal extends Modal {
  private zone: Partial<BoardZone>;
  private onSubmit: (zone: Partial<BoardZone>) => void;
  private isEdit: boolean;

  constructor(app: App, zone: Partial<BoardZone>, onSubmit: (zone: Partial<BoardZone>) => void, isEdit = false) {
    super(app);
    this.zone = { ...zone };
    this.onSubmit = onSubmit;
    this.isEdit = isEdit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("todo-modal");
    contentEl.createEl("h2", { text: this.isEdit ? "编辑分区" : "新建分区", cls: "todo-modal-title" });

    const mkField = (label: string) => {
      const w = contentEl.createDiv("todo-modal-field");
      w.createEl("label", { text: label, cls: "todo-modal-label" });
      return w;
    };

    const dateInput = mkField("日期").createEl("input", { type: "date", cls: "todo-modal-input" });
    dateInput.value = this.zone.date ?? moment().format("YYYY-MM-DD");
    dateInput.focus();

    const labelInput = mkField("自定义标题（可选）").createEl("input", {
      type: "text", cls: "todo-modal-input", placeholder: "留空则自动显示日期",
    });
    labelInput.value = this.zone.label ?? "";

    const btnRow = contentEl.createDiv("todo-modal-buttons");
    btnRow.createEl("button", { text: "取消", cls: "todo-modal-btn todo-modal-btn-cancel" })
      .addEventListener("click", () => this.close());

    const submit = () => {
      if (!dateInput.value) { dateInput.addClass("todo-input-error"); dateInput.focus(); return; }
      this.onSubmit({ date: dateInput.value, label: labelInput.value.trim() });
      this.close();
    };
    btnRow.createEl("button", { text: this.isEdit ? "保存" : "创建", cls: "todo-modal-btn todo-modal-btn-submit" })
      .addEventListener("click", submit);
    dateInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }

  onClose() { this.contentEl.empty(); }
}

// ─── Main View ────────────────────────────────────────────────────────────────

class TodoView extends ItemView {
  private plugin: SimpleTodoPlugin;
  private activeTab: "main" | "trash" = "main";
  private searchQuery = "";

  // cached DOM refs for partial refresh
  private todoListEl: HTMLElement | null = null;
  private boardGridEl: HTMLElement | null = null;
  private trashBodyEl: HTMLElement | null = null;

  // drag: task into zone
  private dragTaskId: string | null = null;
  private dragTaskSourceZoneId: string | null = null;

  // drag: zone reorder
  private dragZoneId: string | null = null;
  private dragZoneOverId: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: SimpleTodoPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType()    { return VIEW_TYPE_TODO; }
  getDisplayText() { return "待办清单"; }
  getIcon()        { return "check-square"; }

  async onOpen()  { this.render(); }
  async onClose() {}

  // ── Full render (called on tab switch / init) ────────────────────────────────

  render() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("todo-root");

    this.renderTopBar(root);

    if (this.activeTab === "main") {
      const body = root.createDiv("todo-main-body");
      this.renderTodoPanel(body);
      this.renderBoardPanel(body);
    } else {
      this.renderTrashPanel(root);
    }
  }

  // ── Partial refresh: only re-render list contents, keep search focus ─────────

  private refreshLists() {
    if (this.activeTab === "main") {
      if (this.todoListEl) {
        this.todoListEl.empty();
        this.fillTodoList(this.todoListEl);
      }
      if (this.boardGridEl) {
        this.boardGridEl.empty();
        this.fillBoardGrid(this.boardGridEl);
      }
    } else {
      if (this.trashBodyEl) {
        this.trashBodyEl.empty();
        this.fillTrashBody(this.trashBodyEl);
      }
    }
  }

  // ── Top bar ─────────────────────────────────────────────────────────────────

  private renderTopBar(parent: HTMLElement) {
    const bar = parent.createDiv("todo-topbar");

    // Tabs
    const tabs = bar.createDiv("todo-tabs");
    tabs.createEl("button", {
      text: "待办 & 规划",
      cls: `todo-tab ${this.activeTab === "main" ? "todo-tab-active" : ""}`,
    }).addEventListener("click", () => { this.activeTab = "main"; this.render(); });

    tabs.createEl("button", {
      text: `已完成 (${this.plugin.settings.trash.length})`,
      cls: `todo-tab ${this.activeTab === "trash" ? "todo-tab-active" : ""}`,
    }).addEventListener("click", () => { this.activeTab = "trash"; this.render(); });

    // Right controls
    const right = bar.createDiv("todo-topbar-right");

    if (this.activeTab === "main") {
      right.createEl("button", { cls: "todo-add-btn", text: "+ 任务" })
        .addEventListener("click", () => this.openAddTaskModal());
      right.createEl("button", { cls: "todo-add-zone-btn", text: "+ 分区" })
        .addEventListener("click", () => this.openAddZoneModal());
    }

    // Search — must be last so it gets focus correctly; input only refreshes lists
    const searchInput = right.createEl("input", {
      type: "text", cls: "todo-search-input", placeholder: "搜索...",
    });
    searchInput.value = this.searchQuery;
    searchInput.addEventListener("input", () => {
      this.searchQuery = searchInput.value;
      this.refreshLists();
    });
  }

  // ── Left panel: todo list ────────────────────────────────────────────────────

  private renderTodoPanel(parent: HTMLElement) {
    const panel = parent.createDiv("todo-panel");
    panel.createEl("div", { text: "待办事项", cls: "todo-panel-title" });

    // Drop zone: drag task back from a zone to "unassigned"
    panel.addEventListener("dragover", (e) => {
      if (this.dragTaskId && this.dragTaskSourceZoneId) {
        e.preventDefault();
        panel.addClass("todo-panel-dragover");
      }
    });
    panel.addEventListener("dragleave", () => panel.removeClass("todo-panel-dragover"));
    panel.addEventListener("drop", async (e) => {
      e.preventDefault();
      panel.removeClass("todo-panel-dragover");
      if (this.dragTaskId && this.dragTaskSourceZoneId) {
        await this.removeTaskFromZone(this.dragTaskId, this.dragTaskSourceZoneId);
        this.dragTaskId = null;
        this.dragTaskSourceZoneId = null;
      }
    });

    const list = panel.createDiv("todo-list");
    this.todoListEl = list;
    this.fillTodoList(list);
  }

  private fillTodoList(list: HTMLElement) {
    list.empty();
    let items = [...this.plugin.settings.todos];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      items = items.filter(t => t.title.toLowerCase().includes(q) || t.note.toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });

    if (items.length === 0) {
      const empty = list.createDiv("todo-empty");
      empty.createEl("div", { text: "🎉", cls: "todo-empty-icon" });
      empty.createEl("div", { text: this.searchQuery ? "没有匹配的事项" : "暂无待办，点击 + 任务 添加", cls: "todo-empty-text" });
      return;
    }
    items.forEach(item => this.renderTaskRow(list, item));
  }

  private renderTaskRow(parent: HTMLElement, item: TodoItem) {
    const inZone = this.plugin.settings.boardZones.some(z => z.todoIds.includes(item.id));
    const row = parent.createDiv("todo-item");
    row.dataset.id = item.id;
    if (inZone)                    row.addClass("todo-item-in-zone");
    if (isOverdue(item.dueDate))   row.addClass("todo-item-overdue");

    row.setAttribute("draggable", "true");
    row.addEventListener("dragstart", (e) => {
      this.dragTaskId = item.id;
      this.dragTaskSourceZoneId = null;
      row.addClass("todo-item-dragging");
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); }
    });
    row.addEventListener("dragend", () => row.removeClass("todo-item-dragging"));

    // Checkbox
    const cb = row.createEl("button", { cls: "todo-checkbox" });
    cb.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/></svg>`;
    cb.addEventListener("click", (e) => { e.stopPropagation(); this.completeTask(item.id); });

    // Content wrapper (relative, so the dot can be positioned)
    const content = row.createDiv("todo-item-content");

    // Small dot indicator for "not yet planned"
    if (!inZone) {
      content.createEl("span", { cls: "todo-unplanned-dot", attr: { "aria-label": "未规划" } });
    }

    const titleRow = content.createDiv("todo-item-title-row");
    titleRow.createEl("span", { text: item.title, cls: "todo-item-title" });
    titleRow.createEl("span", { text: PRIORITY_LABELS[item.priority], cls: `todo-priority-badge todo-priority-${item.priority}` });

    if (item.dueDate || item.note) {
      const meta = content.createDiv("todo-item-meta");
      if (item.dueDate) {
        const cls = isOverdue(item.dueDate) ? "todo-due-overdue" : isDueSoon(item.dueDate) ? "todo-due-soon" : "todo-due-normal";
        meta.createEl("span", { text: `📅 ${formatDueDate(item.dueDate)}`, cls: `todo-due ${cls}` });
      }
      if (item.note) meta.createEl("span", { text: item.note, cls: "todo-item-note" });
    }

    const actions = row.createDiv("todo-item-actions");
    actions.createEl("button", { cls: "todo-action-btn", text: "✏️" })
      .addEventListener("click", (e) => { e.stopPropagation(); this.openEditTaskModal(item); });
    actions.createEl("button", { cls: "todo-action-btn", text: "🗑️" })
      .addEventListener("click", (e) => { e.stopPropagation(); this.deleteTask(item.id); });
  }

  // ── Right panel: board ───────────────────────────────────────────────────────

  private renderBoardPanel(parent: HTMLElement) {
    const panel = parent.createDiv("todo-board-panel");
    panel.createEl("div", { text: "规划板", cls: "todo-panel-title" });

    const grid = panel.createDiv("todo-board-grid");
    this.boardGridEl = grid;
    this.fillBoardGrid(grid);
  }

  private fillBoardGrid(grid: HTMLElement) {
    grid.empty();
    const zones = [...this.plugin.settings.boardZones].sort((a, b) => a.order - b.order);

    if (zones.length === 0) {
      const empty = grid.createDiv("todo-empty");
      empty.createEl("div", { text: "🗂️", cls: "todo-empty-icon" });
      empty.createEl("div", { text: "点击「+ 分区」新建", cls: "todo-empty-text" });
      return;
    }
    zones.forEach(zone => this.renderZoneCard(grid, zone));
  }

  private renderZoneCard(parent: HTMLElement, zone: BoardZone) {
    const today = moment().format("YYYY-MM-DD");
    const isPast  = zone.date < today;
    const isToday = zone.date === today;

    const card = parent.createDiv("todo-zone-card");
    card.dataset.zoneId = zone.id;
    if (isPast)  card.addClass("todo-zone-past");
    if (isToday) card.addClass("todo-zone-today");

    // ── Zone drag-to-reorder ──────────────────────────────────────────────────
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (this.dragZoneId && this.dragZoneId !== zone.id) {
        // zone reorder
        this.dragZoneOverId = zone.id;
        card.addClass("todo-zone-card-zone-over");
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      } else if (this.dragTaskId) {
        // task drop
        card.addClass("todo-zone-card-dragover");
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      }
    });
    card.addEventListener("dragleave", () => {
      card.removeClass("todo-zone-card-dragover");
      card.removeClass("todo-zone-card-zone-over");
      if (this.dragZoneOverId === zone.id) this.dragZoneOverId = null;
    });
    card.addEventListener("drop", async (e) => {
      e.preventDefault();
      card.removeClass("todo-zone-card-dragover");
      card.removeClass("todo-zone-card-zone-over");

      if (this.dragZoneId && this.dragZoneId !== zone.id) {
        // Reorder zones
        await this.reorderZone(this.dragZoneId, zone.id);
        this.dragZoneId = null;
        this.dragZoneOverId = null;
      } else if (this.dragTaskId) {
        // Assign task to zone
        await this.assignTaskToZone(this.dragTaskId, this.dragTaskSourceZoneId, zone.id);
        this.dragTaskId = null;
        this.dragTaskSourceZoneId = null;
      }
    });

    // ── Zone header (drag handle for zone reorder) ────────────────────────────
    const header = card.createDiv("todo-zone-header");
    header.setAttribute("draggable", "true");
    header.addEventListener("dragstart", (e) => {
      this.dragZoneId = zone.id;
      card.addClass("todo-zone-dragging");
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/zone", zone.id); }
      e.stopPropagation();
    });
    header.addEventListener("dragend", () => {
      card.removeClass("todo-zone-dragging");
      this.dragZoneId = null;
    });

    const headerLeft = header.createDiv("todo-zone-header-left");
    headerLeft.createEl("div", {
      text: formatZoneHeader(zone),
      cls: "todo-zone-title",
    });
    headerLeft.createEl("div", {
      text: moment(zone.date, "YYYY-MM-DD").format("YYYY/M/D"),
      cls: "todo-zone-subtitle",
    });

    const headerRight = header.createDiv("todo-zone-header-right");
    headerRight.createEl("span", {
      text: String(zone.todoIds.filter(id => this.plugin.settings.todos.find(t => t.id === id)).length),
      cls: "todo-zone-count",
    });
    headerRight.createEl("button", { cls: "todo-zone-action-btn", text: "✏️" })
      .addEventListener("click", (e) => { e.stopPropagation(); this.openEditZoneModal(zone); });
    headerRight.createEl("button", { cls: "todo-zone-action-btn todo-zone-delete-btn", text: "✕" })
      .addEventListener("click", (e) => { e.stopPropagation(); this.deleteZone(zone.id); });

    // ── Zone body ─────────────────────────────────────────────────────────────
    const body = card.createDiv("todo-zone-body");

    const assignedTodos = zone.todoIds
      .map(id => this.plugin.settings.todos.find(t => t.id === id))
      .filter((t): t is TodoItem => !!t);

    if (assignedTodos.length === 0) {
      body.createDiv("todo-zone-drop-hint").createEl("span", {
        text: "拖入任务",
        cls: "todo-zone-hint-text",
      });
    } else {
      assignedTodos.forEach(item => this.renderZoneTaskRow(body, item, zone.id));
    }
  }

  private renderZoneTaskRow(parent: HTMLElement, item: TodoItem, zoneId: string) {
    const row = parent.createDiv("todo-zone-item");
    row.dataset.id = item.id;
    row.setAttribute("draggable", "true");

    row.addEventListener("dragstart", (e) => {
      this.dragTaskId = item.id;
      this.dragTaskSourceZoneId = zoneId;
      row.addClass("todo-item-dragging");
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); }
      e.stopPropagation();
    });
    row.addEventListener("dragend", () => row.removeClass("todo-item-dragging"));

    const cb = row.createEl("button", { cls: "todo-checkbox todo-checkbox-sm" });
    cb.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/></svg>`;
    cb.addEventListener("click", (e) => { e.stopPropagation(); this.completeTask(item.id); });

    const content = row.createDiv("todo-zone-item-content");
    const titleRow = content.createDiv("todo-zone-item-title-row");
    titleRow.createEl("span", { text: item.title, cls: "todo-zone-item-title" });
    titleRow.createEl("span", { text: PRIORITY_LABELS[item.priority], cls: `todo-priority-badge todo-priority-${item.priority}` });

    // drag-out hint icon
    const dragHint = row.createEl("span", { cls: "todo-zone-drag-hint", text: "⠿" });
    dragHint.setAttribute("aria-hidden", "true");
  }

  // ── Trash panel ──────────────────────────────────────────────────────────────

  private renderTrashPanel(parent: HTMLElement) {
    const body = parent.createDiv("todo-body");
    this.trashBodyEl = body;
    this.fillTrashBody(body);
  }

  private fillTrashBody(body: HTMLElement) {
    body.empty();
    let items = [...this.plugin.settings.trash];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      items = items.filter(t => t.title.toLowerCase().includes(q) || t.note.toLowerCase().includes(q));
    }
    items.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

    if (items.length === 0) {
      const empty = body.createDiv("todo-empty");
      empty.createEl("div", { text: "📭", cls: "todo-empty-icon" });
      empty.createEl("div", { text: "已完成的事项会出现在这里", cls: "todo-empty-text" });
      return;
    }

    const toolbar = body.createDiv("todo-trash-toolbar");
    toolbar.createEl("button", { text: "清空已完成", cls: "todo-clear-btn" })
      .addEventListener("click", () => this.clearTrash());

    items.forEach(item => {
      const row = body.createDiv("todo-item todo-item-done");
      const cb = row.createEl("button", { cls: "todo-checkbox todo-checkbox-done" });
      cb.innerHTML = `<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      cb.addEventListener("click", (e) => { e.stopPropagation(); this.restoreTask(item.id); });

      const content = row.createDiv("todo-item-content");
      content.createDiv("todo-item-title-row").createEl("span", { text: item.title, cls: "todo-item-title todo-item-title-done" });
      if (item.completedAt) {
        content.createDiv("todo-item-meta").createEl("span", {
          text: `完成于 ${moment(item.completedAt).format("MM/DD HH:mm")}`,
          cls: "todo-completed-at",
        });
      }

      const actions = row.createDiv("todo-item-actions");
      actions.createEl("button", { cls: "todo-action-btn", text: "🗑️" })
        .addEventListener("click", (e) => { e.stopPropagation(); this.permanentDelete(item.id); });
    });
  }

  // ── Data actions ─────────────────────────────────────────────────────────────

  private openAddTaskModal() {
    new TodoModal(this.app, { priority: "medium" }, async (data) => {
      this.plugin.settings.todos.unshift({
        id: generateId(), title: data.title!, note: data.note ?? "",
        dueDate: data.dueDate ?? null, priority: data.priority ?? "medium",
        completed: false, completedAt: null, createdAt: new Date().toISOString(),
      });
      await this.plugin.saveSettings();
      this.render();
    }).open();
  }

  private openEditTaskModal(item: TodoItem) {
    new TodoModal(this.app, item, async (data) => {
      const idx = this.plugin.settings.todos.findIndex(t => t.id === item.id);
      if (idx === -1) return;
      this.plugin.settings.todos[idx] = { ...this.plugin.settings.todos[idx], title: data.title!, note: data.note ?? "", dueDate: data.dueDate ?? null, priority: data.priority ?? "medium" };
      await this.plugin.saveSettings();
      this.render();
    }, true).open();
  }

  private openAddZoneModal() {
    new ZoneModal(this.app, {}, async (data) => {
      const maxOrder = this.plugin.settings.boardZones.reduce((m, z) => Math.max(m, z.order), -1);
      this.plugin.settings.boardZones.push({ id: generateId(), date: data.date!, label: data.label ?? "", todoIds: [], order: maxOrder + 1 });
      await this.plugin.saveSettings();
      this.render();
    }).open();
  }

  private openEditZoneModal(zone: BoardZone) {
    new ZoneModal(this.app, zone, async (data) => {
      const idx = this.plugin.settings.boardZones.findIndex(z => z.id === zone.id);
      if (idx === -1) return;
      this.plugin.settings.boardZones[idx] = { ...this.plugin.settings.boardZones[idx], date: data.date!, label: data.label ?? "" };
      await this.plugin.saveSettings();
      this.render();
    }, true).open();
  }

  private async deleteZone(zoneId: string) {
    this.plugin.settings.boardZones = this.plugin.settings.boardZones.filter(z => z.id !== zoneId);
    await this.plugin.saveSettings();
    this.render();
  }

  private async reorderZone(draggedId: string, targetId: string) {
    const zones = [...this.plugin.settings.boardZones].sort((a, b) => a.order - b.order);
    const fromIdx = zones.findIndex(z => z.id === draggedId);
    const toIdx   = zones.findIndex(z => z.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = zones.splice(fromIdx, 1);
    zones.splice(toIdx, 0, moved);
    zones.forEach((z, i) => { z.order = i; });
    this.plugin.settings.boardZones = zones;
    await this.plugin.saveSettings();
    this.render();
  }

  private async assignTaskToZone(taskId: string, sourceZoneId: string | null, targetZoneId: string) {
    if (sourceZoneId === targetZoneId) return;
    if (sourceZoneId) {
      const src = this.plugin.settings.boardZones.find(z => z.id === sourceZoneId);
      if (src) src.todoIds = src.todoIds.filter(id => id !== taskId);
    }
    const target = this.plugin.settings.boardZones.find(z => z.id === targetZoneId);
    if (target && !target.todoIds.includes(taskId)) target.todoIds.push(taskId);
    await this.plugin.saveSettings();
    this.render();
  }

  private async removeTaskFromZone(taskId: string, zoneId: string) {
    const zone = this.plugin.settings.boardZones.find(z => z.id === zoneId);
    if (zone) { zone.todoIds = zone.todoIds.filter(id => id !== taskId); }
    await this.plugin.saveSettings();
    this.render();
  }

  private async completeTask(id: string) {
    this.plugin.settings.boardZones.forEach(z => { z.todoIds = z.todoIds.filter(tid => tid !== id); });
    const idx = this.plugin.settings.todos.findIndex(t => t.id === id);
    if (idx === -1) return;
    const item = this.plugin.settings.todos.splice(idx, 1)[0];
    item.completed = true; item.completedAt = new Date().toISOString();
    this.plugin.settings.trash.unshift(item);
    await this.plugin.saveSettings();
    this.render();
  }

  private async deleteTask(id: string) {
    this.plugin.settings.boardZones.forEach(z => { z.todoIds = z.todoIds.filter(tid => tid !== id); });
    const idx = this.plugin.settings.todos.findIndex(t => t.id === id);
    if (idx === -1) return;
    const item = this.plugin.settings.todos.splice(idx, 1)[0];
    item.completed = true; item.completedAt = new Date().toISOString();
    this.plugin.settings.trash.unshift(item);
    await this.plugin.saveSettings();
    this.render();
  }

  private async restoreTask(id: string) {
    const idx = this.plugin.settings.trash.findIndex(t => t.id === id);
    if (idx === -1) return;
    const item = this.plugin.settings.trash.splice(idx, 1)[0];
    item.completed = false; item.completedAt = null;
    this.plugin.settings.todos.unshift(item);
    await this.plugin.saveSettings();
    this.render();
  }

  private async permanentDelete(id: string) {
    this.plugin.settings.trash = this.plugin.settings.trash.filter(t => t.id !== id);
    await this.plugin.saveSettings();
    this.render();
  }

  private async clearTrash() {
    this.plugin.settings.trash = [];
    await this.plugin.saveSettings();
    this.render();
  }
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class TodoSettingTab extends PluginSettingTab {
  plugin: SimpleTodoPlugin;
  constructor(app: App, plugin: SimpleTodoPlugin) { super(app, plugin); this.plugin = plugin; }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "待办清单设置" });

    new Setting(containerEl).setName("数据统计").setDesc(
      `待办：${this.plugin.settings.todos.length} 项 | 已完成：${this.plugin.settings.trash.length} 项 | 分区：${this.plugin.settings.boardZones.length} 个`
    );

    new Setting(containerEl).setName("清空所有数据").setDesc("删除所有待办、已完成事项和分区，不可撤销。")
      .addButton(btn => btn.setButtonText("清空").setWarning().onClick(async () => {
        this.plugin.settings.todos = [];
        this.plugin.settings.trash = [];
        this.plugin.settings.boardZones = [];
        await this.plugin.saveSettings();
        this.display();
      }));
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class SimpleTodoPlugin extends Plugin {
  settings: TodoSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_TODO, leaf => new TodoView(leaf, this));
    this.addRibbonIcon("check-square", "待办清单", () => this.activateView());
    this.addCommand({ id: "open-todo-list", name: "打开待办清单", callback: () => this.activateView() });
    this.addCommand({
      id: "add-todo-item", name: "新建待办事项",
      callback: () => this.activateView().then(() => {
        const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_TODO)[0]?.view as TodoView | undefined;
        if (view) (view as any).openAddTaskModal();
      }),
    });
    this.addSettingTab(new TodoSettingTab(this.app, this));
  }

  async onunload() { this.app.workspace.detachLeavesOfType(VIEW_TYPE_TODO); }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.boardZones) this.settings.boardZones = [];
    // migrate: ensure order field exists
    this.settings.boardZones.forEach((z, i) => { if (z.order === undefined) z.order = i; });
  }

  async saveSettings() { await this.saveData(this.settings); }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_TODO)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_TODO, active: true });
    }
    workspace.revealLeaf(leaf);
  }
}
