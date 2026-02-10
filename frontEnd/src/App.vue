<template>
  <div class="app-root">
    <header class="app-toolbar">
      <div class="title-block">
        <p class="eyebrow">Vue Shell · React Kernel</p>
        <h1>Excalidraw Hybrid Studio</h1>
        <p class="workspace-label">Workspace: {{ workspaceId }}</p>
      </div>
      <div class="status-block">
        <div class="sync-status" :class="syncClass">
          <span class="dot" aria-hidden="true"></span>
          <span>{{ syncLabel }}</span>
        </div>
        <div v-if="activeUsers.length" class="presence">
          <span class="presence-label">Online</span>
          <div class="presence-list">
            <span v-for="user in activeUsers" :key="user.userId" class="presence-user">
              <span class="presence-dot" :style="{ backgroundColor: user.color }"></span>
              <span class="presence-name">
                {{ user.userId }}<span v-if="user.userId === wsUserId"> (you)</span>
              </span>
            </span>
          </div>
        </div>
      </div>
    </header>

    <ExcalidrawWrapper
      :permissions="{ canEdit }"
      :actions="toolbarActions"
      :files="canvasStore.files"
      :collaborators="collaborators"
      @ready="onReady"
      @change="onChange"
      @pointer="onPointer"
      @snapshot="onSnapshot"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import ExcalidrawWrapper from "@/components/ExcalidrawWrapper.vue";
import eventBus from "@/utils/eventBus";
import { createId } from "@/utils/id";
import type { ActionItem } from "@/react/ExcalidrawHost";
import type { AppState, BinaryFiles, Collaborator, SocketId } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useCanvasStore } from "@/stores/canvasStore";
import {
  createCanvas,
  getCanvas,
  listCanvases,
  saveSnapshot,
  type Snapshot,
} from "@/services/canvasApi";
import google from "@/assets/google.png";

const canEdit = ref(true);
const canvasStore = useCanvasStore();
const canvasId = ref<string | null>(null);
const workspaceId = ref("default");
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");
const isLoading = ref(true);
const loadError = ref<string | null>(null);
const saveState = ref<"idle" | "saving" | "error">("idle");
const lastSavedAt = ref<string | null>(null);
const suppressSave = ref(true);
let saveTimer: number | null = null;
let wsUpdateTimer: number | null = null;
let cursorTimer: number | null = null;
let reconnectTimer: number | null = null;
const wsConnection = ref<WebSocket | null>(null);
const wsJoined = ref(false);
const wsUserId = ref<string | null>(null);
const wsUserColor = ref<string | null>(null);
const activeUsers = ref<Array<{ userId: string; color: string }>>([]);
const collaborators = ref(new Map<SocketId, Collaborator>());

const normalizeAppState = (appState?: Partial<AppState> | null) => {
  const base = (appState ?? {}) as Partial<AppState> & {
    collaborators?: unknown;
  };
  const collaborators =
    base.collaborators instanceof Map ? base.collaborators : new Map();
  return {
    ...base,
    collaborators,
  } as Partial<AppState>;
};

const sanitizeAppStateForSave = (appState: AppState) => {
  const safeState = { ...appState } as Record<string, unknown>;
  delete safeState.collaborators;
  return safeState;
};

const getWorkspaceIdFromUrl = () => {
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get("workspace");
  if (fromQuery) return fromQuery;

  const path = url.pathname.replace(/\/+$/, "");
  const match = path.match(/\/workspace(?:=|\/)([^/]+)$/);
  if (match?.[1]) return decodeURIComponent(match[1]);

  return "default";
};

const buildWsUrl = () => {
  if (API_BASE.startsWith("http")) {
    const apiUrl = new URL(API_BASE);
    const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${apiUrl.host}/ws`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
};

const sendWsMessage = (payload: Record<string, unknown>) => {
  if (!wsConnection.value || wsConnection.value.readyState !== WebSocket.OPEN) return;
  wsConnection.value.send(JSON.stringify(payload));
};

const applyRemoteUpdate = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return;
  const data = payload as {
    elements?: ExcalidrawElement[];
    files?: BinaryFiles;
  };
  if (data.elements) canvasStore.setServerElements(data.elements);
  if (data.files) canvasStore.setServerFiles(data.files);
};

const setCollaborators = () => {
  canvasStore.setServerAppState({
    collaborators: new Map(collaborators.value),
  });
};

const removeCollaborator = (userId: SocketId) => {
  if (!collaborators.value.has(userId)) return;
  collaborators.value.delete(userId);
  setCollaborators();
};

const scheduleReconnect = () => {
  if (reconnectTimer) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    if (canvasId.value) connectWebSocket(canvasId.value);
  }, 1200);
};

const connectWebSocket = (targetCanvasId: string) => {
  if (wsConnection.value) {
    wsConnection.value.close();
    wsConnection.value = null;
  }

  wsJoined.value = false;
  const ws = new WebSocket(buildWsUrl());
  wsConnection.value = ws;

  ws.onopen = () => {
    sendWsMessage({ type: "join", canvasId: targetCanvasId });
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data as string) as {
        type?: string;
        payload?: unknown;
        userId?: string;
        color?: string;
        users?: Array<{ userId: string; color: string }>;
      };
      if (message.type === "connected") {
        wsUserId.value = message.userId ?? null;
        wsUserColor.value = message.color ?? null;
        return;
      }
      if (message.type === "joined") {
        wsJoined.value = true;
        activeUsers.value = message.users ?? [];
        return;
      }
      if (message.type === "user_joined" && message.userId && message.color) {
        if (!activeUsers.value.some((user) => user.userId === message.userId)) {
          activeUsers.value = [...activeUsers.value, {
            userId: message.userId,
            color: message.color,
          }];
        }
        return;
      }
      if (message.type === "user_left" && message.userId) {
        activeUsers.value = activeUsers.value.filter((user) => user.userId !== message.userId);
        removeCollaborator(message.userId as SocketId);
        return;
      }
      if (message.type === "cursor" && message.userId && message.color) {
        if (message.userId === wsUserId.value) return;
        const rawPayload = message.payload as Record<string, unknown> | null | undefined;
        const pointer = rawPayload && typeof rawPayload === "object"
          ? (rawPayload as { pointer?: unknown }).pointer ?? rawPayload
          : rawPayload;
        collaborators.value.set(message.userId as SocketId, {
          pointer: pointer as any,
          button: rawPayload && typeof rawPayload === "object"
            ? (rawPayload as { button?: "up" | "down" }).button
            : "up",
          username: message.userId,
          color: {
            background: message.color,
            stroke: message.color,
          },
        });
        setCollaborators();
        return;
      }
      if (message.type === "update") {
        applyRemoteUpdate(message.payload);
      }
    } catch (err) {
      console.warn("[WS] Invalid message:", err);
    }
  };

  ws.onclose = () => {
    wsJoined.value = false;
    activeUsers.value = [];
    collaborators.value.clear();
    setCollaborators();
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws.close();
  };
};

const setSaveGate = (open: boolean) => {
  suppressSave.value = !open;
};

const applySnapshot = (snapshot?: Snapshot | null) => {
  if (!snapshot) return;
  const elements = (snapshot.elements ?? []) as ExcalidrawElement[];
  const files = (snapshot.files ?? {}) as BinaryFiles;
  const appState = normalizeAppState(snapshot.appState);
  canvasStore.setElements(elements);
  canvasStore.setFiles(files);
  canvasStore.setAppState(appState);
  canvasStore.setServerElements(elements);
  canvasStore.setServerFiles(files);
  canvasStore.setServerAppState(appState);
};

const loadCanvas = async () => {
  isLoading.value = true;
  loadError.value = null;
  setSaveGate(false);
  try {
    const { canvases } = await listCanvases();
    const existing = canvases.find((canvas) => canvas.name === workspaceId.value);
    let targetId = existing?.id;
    if (!targetId) {
      const created = await createCanvas(workspaceId.value);
      targetId = created.canvas.id;
    }

    canvasId.value = targetId;
    const { canvas } = await getCanvas(targetId);
    applySnapshot(canvas.snapshot);
    connectWebSocket(targetId);
  } catch (err) {
    console.error("[API] Load canvas failed:", err);
    loadError.value = err instanceof Error ? err.message : "Backend unavailable";
  } finally {
    isLoading.value = false;
    window.setTimeout(() => setSaveGate(true), 400);
  }
};

const toggleEdit = () => {
  canEdit.value = !canEdit.value;
};

const onReady = () => {
  // Hook for API-ready events.
};

const queueSave = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) => {
  if (!canvasId.value || suppressSave.value || !canEdit.value) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    saveState.value = "saving";
    try {
      const safeState = sanitizeAppStateForSave(appState);
      await saveSnapshot(canvasId.value as string, elements, safeState, files);
      lastSavedAt.value = new Date().toISOString();
      saveState.value = "idle";
    } catch (err) {
      console.error("[API] Save snapshot failed:", err);
      saveState.value = "error";
    }
  }, 800);
};

const queueWsUpdate = (
  elements: readonly ExcalidrawElement[],
  _appState: AppState,
  files: BinaryFiles,
) => {
  if (!canEdit.value || suppressSave.value) return;
  if (!wsConnection.value || wsConnection.value.readyState !== WebSocket.OPEN) return;
  if (!wsJoined.value) return;

  if (wsUpdateTimer) window.clearTimeout(wsUpdateTimer);
  wsUpdateTimer = window.setTimeout(() => {
    sendWsMessage({
      type: "update",
      payload: { elements, files },
    });
  }, 120);
};

const onPointer = (payload: unknown) => {
  if (!wsConnection.value || wsConnection.value.readyState !== WebSocket.OPEN) return;
  if (!wsJoined.value || !canEdit.value) return;
  if (!payload) return;
  if (cursorTimer) return;
  cursorTimer = window.setTimeout(() => {
    cursorTimer = null;
    sendWsMessage({
      type: "cursor",
      payload,
    });
  }, 50);
};

const onChange = (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
  queueSave(elements, appState, files);
  queueWsUpdate(elements, appState, files);
};

const onSnapshot = (blob: Blob) => {
  // Example: you can upload or store the blob.
  void blob;
};

const addMarkdown = () => {
  eventBus.emit("addExtraResource", {
    id: createId("overlay"),
    type: "markdown",
    content: "# Team Notes\n- Vue shell\n- React core\n- Overlay bridge",
    x: -180,
    y: -120,
    width: 300,
    height: 180,
  });
};

const addVideo = () => {
  eventBus.emit("addExtraResource", {
    id: createId("overlay"),
    type: "video",
    url: google,
    x: 140,
    y: -100,
    width: 320,
    height: 200,
  });
};

const addApp = () => {
  eventBus.emit("addExtraResource", {
    id: createId("overlay"),
    type: "custom",
    content: "DomTest Component",
    x: -140,
    y: 140,
    width: 200,
    height: 200,
  });
};

const handleImageFile = (file: File) => {
  eventBus.emit("addExtraResource", {
    id: createId("overlay"),
    type: "image",
    file,
    x: 220,
    y: 120,
    width: 320,
    height: 220,
  });
};

const toolbarActions = computed<ActionItem[]>(() => [
  {
    id: "toggle-edit",
    label: canEdit.value ? "Switch to Readonly" : "Switch to Edit",
    onClick: toggleEdit,
    primary: true,
  },
  {
    id: "add-markdown",
    label: "Add Markdown",
    onClick: addMarkdown,
  },
  {
    id: "add-video",
    label: "Add Video",
    onClick: addVideo,
  },
  {
    id: "add-app",
    label: "Add App",
    onClick: addApp,
  },
  {
    id: "add-image",
    label: "Add Image",
    fileInput: true,
    accept: "image/*",
    onClick: () => {},
    onFileChange: handleImageFile,
  },
]);

const syncLabel = computed(() => {
  if (isLoading.value) return "Connecting...";
  if (loadError.value) return `Backend offline: ${loadError.value}`;
  if (saveState.value === "saving") return "Syncing...";
  if (saveState.value === "error") return "Sync error";
  if (lastSavedAt.value) {
    const time = new Date(lastSavedAt.value).toLocaleTimeString();
    return `Saved ${time}`;
  }
  return "Ready";
});

const syncClass = computed(() => ({
  "is-loading": isLoading.value,
  "is-error": Boolean(loadError.value) || saveState.value === "error",
  "is-saving": saveState.value === "saving",
}));

onMounted(() => {
  workspaceId.value = getWorkspaceIdFromUrl();
  void loadCanvas();
});

onBeforeUnmount(() => {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (wsUpdateTimer) {
    window.clearTimeout(wsUpdateTimer);
    wsUpdateTimer = null;
  }
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (cursorTimer) {
    window.clearTimeout(cursorTimer);
    cursorTimer = null;
  }
  if (wsConnection.value) {
    wsConnection.value.close();
    wsConnection.value = null;
  }
});
</script>
