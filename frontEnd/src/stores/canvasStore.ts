import { defineStore } from "pinia";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export const mergeElements = (
  base: readonly ExcalidrawElement[],
  incoming: readonly ExcalidrawElement[],
) => {
  const map = new Map<string, ExcalidrawElement>();
  base.forEach((el) => map.set(el.id, el));
  incoming.forEach((el) => {
    const existing = map.get(el.id);
    if (!existing) {
      map.set(el.id, el);
      return;
    }

    const currentVersion = (existing as any).version ?? 0;
    const nextVersion = (el as any).version ?? 0;
    map.set(el.id, nextVersion >= currentVersion ? el : existing);
  });

  return Array.from(map.values());
};

export const useCanvasStore = defineStore("canvas", {
  state: () => ({
    elements: [] as ExcalidrawElement[],
    appState: { collaborators: new Map() } as Partial<AppState>,
    files: {} as BinaryFiles,
    serverElements: [] as ExcalidrawElement[],
    serverFiles: {} as BinaryFiles,
    serverAppState: { collaborators: new Map() } as Partial<AppState>,
  }),
  actions: {
    normalizeAppState(appState: Partial<AppState>) {
      const collaborators =
        appState.collaborators instanceof Map ? appState.collaborators : new Map();
      return {
        ...appState,
        collaborators,
      } as Partial<AppState>;
    },
    setElements(elements: readonly ExcalidrawElement[]) {
      this.elements = [...elements];
    },
    setAppState(appState: Partial<AppState>) {
      this.appState = this.normalizeAppState(appState);
    },
    setFiles(files: BinaryFiles) {
      this.files = { ...files };
    },
    setServerElements(elements: readonly ExcalidrawElement[]) {
      this.serverElements = [...elements];
    },
    setServerFiles(files: BinaryFiles) {
      this.serverFiles = { ...files };
    },
    setServerAppState(appState: Partial<AppState>) {
      this.serverAppState = this.normalizeAppState(appState);
    },
  },
});
