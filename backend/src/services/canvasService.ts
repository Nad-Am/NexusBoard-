import { db } from "../db/client.js";
import { createId } from "../utils/id.js";

class CanvasService {
  // 获取所有画布
  async list() {
    return db.canvases.findAll().sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  // 创建新画布
  async create(name?: string) {
    const id = createId();
    const now = new Date().toISOString();
    
    const canvas = db.canvases.create({
      id,
      name: name || "Untitled",
      currentVersion: 0,
      createdAt: now,
      updatedAt: now,
    });
    
    // 创建初始空快照
    db.snapshots.create({
      id: createId(),
      canvasId: id,
      version: 0,
      elements: [],
      appState: {},
      files: {},
      createdAt: now,
    });
    
    return canvas;
  }

  // 获取画布详情（带最新快照）
  async getById(id: string) {
    const canvas = db.canvases.findById(id);
    if (!canvas) return null;

    const snapshot = db.snapshots.findLatest(id);

    return {
      ...canvas,
      snapshot,
    };
  }

  // 获取指定版本快照
  async getVersion(canvasId: string, version: number) {
    return db.snapshots.findByVersion(canvasId, version) || null;
  }

  // 获取所有版本列表
  async listVersions(canvasId: string) {
    return db.snapshots.findByCanvasId(canvasId)
      .map(s => ({ id: s.id, version: s.version, createdAt: s.createdAt }))
      .sort((a, b) => b.version - a.version);
  }

  // 保存新快照
  async saveSnapshot(
    canvasId: string,
    elements: unknown[],
    appState?: Record<string, unknown>,
    files?: Record<string, unknown>
  ) {
    const canvas = db.canvases.findById(canvasId);
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    const newVersion = canvas.currentVersion + 1;
    const snapshotId = createId();
    const now = new Date().toISOString();

    // 创建新快照
    db.snapshots.create({
      id: snapshotId,
      canvasId,
      version: newVersion,
      elements,
      appState: appState || {},
      files: files || {},
      createdAt: now,
    });

    // 更新画布版本
    db.canvases.update(canvasId, { 
      currentVersion: newVersion, 
      updatedAt: now 
    });

    return {
      id: snapshotId,
      canvasId,
      version: newVersion,
    };
  }

  // 删除画布
  async delete(id: string) {
    db.canvases.delete(id);
  }
}

export const canvasService = new CanvasService();
