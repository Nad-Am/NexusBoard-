import Router from "@koa/router";
import { canvasService } from "../services/canvasService.js";

const router = new Router({ prefix: "/api/canvases" });

// 获取所有画布列表
router.get("/", async (ctx) => {
  const canvases = await canvasService.list();
  ctx.body = { canvases };
});

// 创建新画布
router.post("/", async (ctx) => {
  const { name } = ctx.request.body as { name?: string };
  const canvas = await canvasService.create(name);
  ctx.status = 201;
  ctx.body = { canvas };
});

// 获取单个画布详情（包含最新快照）
router.get("/:id", async (ctx) => {
  const { id } = ctx.params;
  const canvas = await canvasService.getById(id);
  if (!canvas) {
    ctx.status = 404;
    ctx.body = { error: "Canvas not found" };
    return;
  }
  ctx.body = { canvas };
});

// 获取画布指定版本
router.get("/:id/versions/:version", async (ctx) => {
  const { id, version } = ctx.params;
  const snapshot = await canvasService.getVersion(id, parseInt(version, 10));
  if (!snapshot) {
    ctx.status = 404;
    ctx.body = { error: "Version not found" };
    return;
  }
  ctx.body = { snapshot };
});

// 获取画布所有版本列表
router.get("/:id/versions", async (ctx) => {
  const { id } = ctx.params;
  const versions = await canvasService.listVersions(id);
  ctx.body = { versions };
});

// 保存画布快照
router.post("/:id/save", async (ctx) => {
  const { id } = ctx.params;
  const { elements, appState, files } = ctx.request.body as {
    elements: unknown[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
  };
  
  const snapshot = await canvasService.saveSnapshot(id, elements, appState, files);
  ctx.status = 201;
  ctx.body = { snapshot };
});

// 删除画布
router.delete("/:id", async (ctx) => {
  const { id } = ctx.params;
  await canvasService.delete(id);
  ctx.status = 204;
});

export { router as canvasRouter };
