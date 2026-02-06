import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createId, createShortId } from "../utils/id.js";

type Message = {
  type: "join" | "leave" | "update" | "cursor" | "sync";
  canvasId?: string;
  userId?: string;
  payload?: unknown;
};

type Client = {
  id: string;
  ws: WebSocket;
  canvasId: string | null;
  userId: string;
  color: string;
};

// 房间管理：canvasId -> Set<Client>
const rooms = new Map<string, Set<Client>>();
const clients = new Map<WebSocket, Client>();

// 随机颜色
const colors = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6"];
const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];

export function setupWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    const client: Client = {
      id: createId(),
      ws,
      canvasId: null,
      userId: `user-${createShortId(8)}`,
      color: getRandomColor(),
    };
    clients.set(ws, client);

    // 发送连接确认
    ws.send(JSON.stringify({
      type: "connected",
      userId: client.userId,
      color: client.color,
    }));

    ws.on("message", (data) => {
      try {
        const msg: Message = JSON.parse(data.toString());
        handleMessage(client, msg);
      } catch (e) {
        console.error("[WS] Invalid message:", e);
      }
    });

    ws.on("close", () => {
      // 离开房间
      if (client.canvasId) {
        leaveRoom(client);
      }
      clients.delete(ws);
    });
  });

  console.log("📡 WebSocket server initialized on /ws");
}

function handleMessage(client: Client, msg: Message) {
  switch (msg.type) {
    case "join":
      if (msg.canvasId) {
        joinRoom(client, msg.canvasId);
      }
      break;

    case "leave":
      if (client.canvasId) {
        leaveRoom(client);
      }
      break;

    case "update":
      // 广播元素更新给房间内其他人
      broadcastToRoom(client, {
        type: "update",
        userId: client.userId,
        payload: msg.payload,
      });
      break;

    case "cursor":
      // 广播光标位置
      broadcastToRoom(client, {
        type: "cursor",
        userId: client.userId,
        color: client.color,
        payload: msg.payload,
      });
      break;

    case "sync":
      // 请求同步当前画布状态
      // TODO: 从数据库获取最新状态并发送
      break;
  }
}

function joinRoom(client: Client, canvasId: string) {
  // 离开旧房间
  if (client.canvasId) {
    leaveRoom(client);
  }

  // 加入新房间
  client.canvasId = canvasId;
  if (!rooms.has(canvasId)) {
    rooms.set(canvasId, new Set());
  }
  rooms.get(canvasId)!.add(client);

  // 通知房间内其他人
  broadcastToRoom(client, {
    type: "user_joined",
    userId: client.userId,
    color: client.color,
  });

  // 通知客户端已加入
  client.ws.send(JSON.stringify({
    type: "joined",
    canvasId,
    users: getActiveRoom(canvasId),
  }));

  console.log(`[WS] ${client.userId} joined room ${canvasId}`);
}

function leaveRoom(client: Client) {
  if (!client.canvasId) return;

  const room = rooms.get(client.canvasId);
  if (room) {
    room.delete(client);
    if (room.size === 0) {
      rooms.delete(client.canvasId);
    }
  }

  // 通知房间内其他人
  broadcastToRoom(client, {
    type: "user_left",
    userId: client.userId,
  });

  console.log(`[WS] ${client.userId} left room ${client.canvasId}`);
  client.canvasId = null;
}

function broadcastToRoom(sender: Client, msg: object) {
  if (!sender.canvasId) return;

  const room = rooms.get(sender.canvasId);
  if (!room) return;

  const data = JSON.stringify(msg);
  for (const client of room) {
    if (client.id !== sender.id && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function getActiveRoom(canvasId: string) {
  const room = rooms.get(canvasId);
  if (!room) return [];
  
  return Array.from(room).map((c) => ({
    userId: c.userId,
    color: c.color,
  }));
}
