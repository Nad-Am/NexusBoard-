# CortexSketch

协作共享画布空间，支持多人实时编辑、光标同步、画布版本保存。前端使用 Vue + React 混合架构，后端使用 Koa + WebSocket。

## 目录结构

- `backend/` 后端服务（REST + WebSocket）
- `frontEnd/` 前端应用（Vite + Vue + Excalidraw）

## 前置条件

- Node.js 18+ (推荐 20+)
- pnpm 8+

## 安装依赖

在两个子项目内分别安装：

```bash
cd backend
pnpm i

cd ../frontEnd
pnpm i
```

## 启动开发环境

### 启动后端

```bash
cd backend
pnpm dev
```

默认监听 `http://localhost:3001`，WebSocket 路径为 `/ws`。

### 启动前端

```bash
cd frontEnd
pnpm dev
```

默认监听 `http://localhost:5173`。

## 环境变量

前端可配置后端地址（可选）：

- `VITE_API_BASE` 例如：`http://localhost:3001`

## Workspace 规则

不同 workspace 通过 URL 区分，访问同一 workspace 会进入同一画布：

- `http://localhost:5173/?workspace=team-a`
- `http://localhost:5173/workspace/team-a`
- `http://localhost:5173/workspace=team-a`

## 功能说明

- 多人实时协作：元素增删改同步（视图平移/缩放不同步）
- 光标/选区展示
- 画布快照保存（后端持久化）

## 常见问题

- 画布未同步：确认前端 `VITE_API_BASE` 指向同一后端，且后端 `/ws` 可访问。
- 多窗口不同步：确认 URL 的 workspace 参数一致。
