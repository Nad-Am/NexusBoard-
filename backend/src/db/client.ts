import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, desc, and } from "drizzle-orm";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { canvases, canvasSnapshots, operations } from "./schema.js";

const DB_PATH = "./data/excalidraw.db";

// Ensure data directory exists
const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

// Create SQLite connection
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL"); // Enable WAL mode for better concurrency

// Initialize Drizzle ORM
const drizzleDb = drizzle(sqlite);

// Types (matching previous interface for compatibility)
export type Canvas = {
  id: string;
  name: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type CanvasSnapshot = {
  id: string;
  canvasId: string;
  version: number;
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
  createdAt: string;
};

export type Operation = {
  id: string;
  canvasId: string;
  baseVersion: number;
  opType: "add" | "update" | "delete";
  elementId: string;
  payload: Record<string, unknown>;
  userId?: string;
  createdAt: string;
};

// Helper to convert Date to ISO string
const toISOString = (date: Date | null | undefined): string => 
  date ? date.toISOString() : new Date().toISOString();

// Database interface (maintaining compatibility with previous API)
export const db = {
  // Canvas operations
  canvases: {
    findAll(): Canvas[] {
      const rows = drizzleDb.select().from(canvases).all();
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        currentVersion: r.currentVersion,
        createdAt: toISOString(r.createdAt),
        updatedAt: toISOString(r.updatedAt),
      }));
    },

    findById(id: string): Canvas | undefined {
      const row = drizzleDb.select().from(canvases).where(eq(canvases.id, id)).get();
      if (!row) return undefined;
      return {
        id: row.id,
        name: row.name,
        currentVersion: row.currentVersion,
        createdAt: toISOString(row.createdAt),
        updatedAt: toISOString(row.updatedAt),
      };
    },

    create(canvas: Canvas): Canvas {
      drizzleDb.insert(canvases).values({
        id: canvas.id,
        name: canvas.name,
        currentVersion: canvas.currentVersion,
        createdAt: new Date(canvas.createdAt),
        updatedAt: new Date(canvas.updatedAt),
      }).run();
      return canvas;
    },

    update(id: string, updates: Partial<Canvas>): Canvas | null {
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.currentVersion !== undefined) updateData.currentVersion = updates.currentVersion;
      if (updates.updatedAt !== undefined) updateData.updatedAt = new Date(updates.updatedAt);
      
      drizzleDb.update(canvases).set(updateData).where(eq(canvases.id, id)).run();
      return this.findById(id) || null;
    },

    delete(id: string): void {
      // Cascade delete handled by SQLite foreign keys
      drizzleDb.delete(canvases).where(eq(canvases.id, id)).run();
    }
  },

  // Snapshot operations
  snapshots: {
    findByCanvasId(canvasId: string): CanvasSnapshot[] {
      const rows = drizzleDb.select().from(canvasSnapshots)
        .where(eq(canvasSnapshots.canvasId, canvasId)).all();
      return rows.map(r => ({
        id: r.id,
        canvasId: r.canvasId,
        version: r.version,
        elements: r.elements as unknown[],
        appState: (r.appState || {}) as Record<string, unknown>,
        files: (r.files || {}) as Record<string, unknown>,
        createdAt: toISOString(r.createdAt),
      }));
    },

    findLatest(canvasId: string): CanvasSnapshot | null {
      const row = drizzleDb.select().from(canvasSnapshots)
        .where(eq(canvasSnapshots.canvasId, canvasId))
        .orderBy(desc(canvasSnapshots.version))
        .limit(1)
        .get();
      if (!row) return null;
      return {
        id: row.id,
        canvasId: row.canvasId,
        version: row.version,
        elements: row.elements as unknown[],
        appState: (row.appState || {}) as Record<string, unknown>,
        files: (row.files || {}) as Record<string, unknown>,
        createdAt: toISOString(row.createdAt),
      };
    },

    findByVersion(canvasId: string, version: number): CanvasSnapshot | undefined {
      const row = drizzleDb.select().from(canvasSnapshots)
        .where(and(
          eq(canvasSnapshots.canvasId, canvasId),
          eq(canvasSnapshots.version, version)
        ))
        .get();
      if (!row) return undefined;
      return {
        id: row.id,
        canvasId: row.canvasId,
        version: row.version,
        elements: row.elements as unknown[],
        appState: (row.appState || {}) as Record<string, unknown>,
        files: (row.files || {}) as Record<string, unknown>,
        createdAt: toISOString(row.createdAt),
      };
    },

    create(snapshot: CanvasSnapshot): CanvasSnapshot {
      drizzleDb.insert(canvasSnapshots).values({
        id: snapshot.id,
        canvasId: snapshot.canvasId,
        version: snapshot.version,
        elements: snapshot.elements,
        appState: snapshot.appState,
        files: snapshot.files,
        createdAt: new Date(snapshot.createdAt),
      }).run();
      return snapshot;
    }
  },

  // Operation operations (for history)
  operations: {
    findByCanvasId(canvasId: string): Operation[] {
      const rows = drizzleDb.select().from(operations)
        .where(eq(operations.canvasId, canvasId)).all();
      return rows.map(r => ({
        id: r.id,
        canvasId: r.canvasId,
        baseVersion: r.baseVersion,
        opType: r.opType,
        elementId: r.elementId,
        payload: r.payload,
        userId: r.userId || undefined,
        createdAt: toISOString(r.createdAt),
      }));
    },

    create(operation: Operation): Operation {
      drizzleDb.insert(operations).values({
        id: operation.id,
        canvasId: operation.canvasId,
        baseVersion: operation.baseVersion,
        opType: operation.opType,
        elementId: operation.elementId,
        payload: operation.payload,
        userId: operation.userId,
        createdAt: new Date(operation.createdAt),
      }).run();
      return operation;
    }
  }
};
