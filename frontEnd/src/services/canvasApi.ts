import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

type Canvas = {
  id: string;
  name: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  snapshot?: Snapshot | null;
};

type Snapshot = {
  id: string;
  canvasId: string;
  version: number;
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  createdAt: string;
};

type ApiListResponse = { canvases: Canvas[] };
type ApiCanvasResponse = { canvas: Canvas };
type ApiSnapshotResponse = { snapshot: Snapshot };

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

const buildUrl = (path: string) => `${API_BASE}${path}`;

const parseJson = (text: string) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error || response.statusText;
    throw new Error(message);
  }

  return data as T;
};

export const listCanvases = () =>
  request<ApiListResponse>("/api/canvases");

export const createCanvas = (name?: string) =>
  request<ApiCanvasResponse>("/api/canvases", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const getCanvas = (id: string) =>
  request<ApiCanvasResponse>(`/api/canvases/${id}`);

export const saveSnapshot = (
  id: string,
  elements: readonly ExcalidrawElement[],
  appState?: Record<string, unknown>,
  files?: BinaryFiles,
) =>
  request<ApiSnapshotResponse>(`/api/canvases/${id}/save`, {
    method: "POST",
    body: JSON.stringify({ elements, appState, files }),
  });

export type { Canvas, Snapshot };
