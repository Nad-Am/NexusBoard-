import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// 画布表
export const canvases = sqliteTable("canvases", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Untitled"),
  currentVersion: integer("current_version").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// 画布快照表（完整状态，用于版本回溯）
export const canvasSnapshots = sqliteTable("canvas_snapshots", {
  id: text("id").primaryKey(),
  canvasId: text("canvas_id").notNull().references(() => canvases.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  elements: text("elements", { mode: "json" }).notNull().$type<unknown[]>(),
  appState: text("app_state", { mode: "json" }).$type<Record<string, unknown>>(),
  files: text("files", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// 操作日志表（增量操作，Git-like）
export const operations = sqliteTable("operations", {
  id: text("id").primaryKey(),
  canvasId: text("canvas_id").notNull().references(() => canvases.id, { onDelete: "cascade" }),
  baseVersion: integer("base_version").notNull(),
  opType: text("op_type", { enum: ["add", "update", "delete"] }).notNull(),
  elementId: text("element_id").notNull(),
  payload: text("payload", { mode: "json" }).notNull().$type<Record<string, unknown>>(),
  userId: text("user_id"), // 预留用户字段
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// 协作会话表
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  canvasId: text("canvas_id").notNull().references(() => canvases.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  cursorX: integer("cursor_x"),
  cursorY: integer("cursor_y"),
  color: text("color").notNull().default("#f97316"),
  lastActiveAt: integer("last_active_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
