import type { AppState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExtraResource } from "./types";

const DEFAULT_SIZE = 320;

type OverlayItem = {
  id: string;
  type: ExtraResource["type"];
  el: HTMLElement;
};

const createPlaceholderElement = (resource: ExtraResource): ExcalidrawElement => {
  const width = resource.width ?? DEFAULT_SIZE;
  const height = resource.height ?? DEFAULT_SIZE;

  return {
    id: resource.id,
    type: "rectangle",
    x: resource.x ?? 0,
    y: resource.y ?? 0,
    width,
    height,
    angle: 0,
    strokeColor: "#6366f1",
    backgroundColor: "rgba(99, 102, 241, 0.05)",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "dashed",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    isDeleted: false,
    boundElements: null,
    locked: false,
    link: null,
    updated: Date.now(),
    roundness: null,
    index: null,
    frameId: null,
    customData: {
      overlayId: resource.id,
      overlayType: resource.type,
      overlayContent: resource.content,
      overlayUrl: resource.url,
    },
  } as any as ExcalidrawElement;
};

const createOverlayNode = (resource: ExtraResource) => {
  let el: HTMLElement;
  if (resource.type === "markdown") {
    el = document.createElement("div");
    el.textContent = resource.content ?? "";
  } else if (resource.type === "video") {
    const video = document.createElement("video");
    video.controls = true;
    if (resource.url) video.src = resource.url;
    el = video;
  } else if (resource.type === "app") {
    const iframe = document.createElement("iframe");
    iframe.allow = "clipboard-read; clipboard-write";
    if (resource.url) iframe.src = resource.url;
    el = iframe;
  } else {
    const img = document.createElement("img");
    if (resource.url) img.src = resource.url;
    el = img;
  }

  el.classList.add("overlay-item", `overlay-${resource.type}`);
  // Hide initially to prevent flickering at (0,0) before first position update
  el.style.visibility = "hidden";
  return el;
};

export default class OverlayManager {
  private root: HTMLElement;
  private items = new Map<string, OverlayItem>();

  constructor(root: HTMLElement) {
    this.root = root;
  }

  batchCreateOverlays(resources: ExtraResource[]) {
    const elements: ExcalidrawElement[] = [];

    resources.forEach((resource) => {
      if (this.items.has(resource.id)) return;

      const el = createOverlayNode(resource);
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      el.style.transformOrigin = "top left";
      el.style.pointerEvents = "none";

      this.root.appendChild(el);
      this.items.set(resource.id, { id: resource.id, type: resource.type, el });
      elements.push(createPlaceholderElement(resource));
    });

    return { elements };
  }

  recreateOverlayFromElement(element: ExcalidrawElement) {
    const customData = (element as any).customData;
    if (!customData?.overlayId || !customData?.overlayType) return;
    if (this.items.has(customData.overlayId)) return;

    const resource: ExtraResource = {
      id: customData.overlayId,
      type: customData.overlayType,
      content: customData.overlayContent,
      url: customData.overlayUrl,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };

    const el = createOverlayNode(resource);
    el.style.position = "absolute";
    el.style.left = "0";
    el.style.top = "0";
    el.style.transformOrigin = "top left";
    el.style.pointerEvents = "none";

    this.root.appendChild(el);
    this.items.set(resource.id, { id: resource.id, type: resource.type, el });
  }

  updatePositions(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    container: HTMLElement,
  ) {
    const zoom = appState.zoom?.value ?? 1;
    const scrollX = appState.scrollX ?? 0;
    const scrollY = appState.scrollY ?? 0;
    
    // Find Excalidraw's actual canvas element and calculate offset relative to our container
    const excalidrawCanvas = container.querySelector('canvas.excalidraw__canvas') as HTMLCanvasElement | null;
    const containerRect = container.getBoundingClientRect();
    
    let canvasOffsetX = 0;
    let canvasOffsetY = 0;
    
    if (excalidrawCanvas) {
      const canvasRect = excalidrawCanvas.getBoundingClientRect();
      canvasOffsetX = canvasRect.left - containerRect.left;
      canvasOffsetY = canvasRect.top - containerRect.top;
    }

    elements.forEach((element) => {
      const overlayId = (element as any).customData?.overlayId as string | undefined;
      if (!overlayId) return;

      const item = this.items.get(overlayId);
      if (!item) return;

      // Excalidraw coordinate conversion:
      // viewportX = (sceneX + scrollX) * zoom + canvasOffset
      const viewportX = (element.x + scrollX) * zoom + canvasOffsetX;
      const viewportY = (element.y + scrollY) * zoom + canvasOffsetY;
      const width = element.width * zoom;
      const height = element.height * zoom;

      item.el.style.transform = `translate(${viewportX}px, ${viewportY}px)`;
      item.el.style.width = `${width}px`;
      item.el.style.height = `${height}px`;
      
      // Show element once positioned
      if (item.el.style.visibility === "hidden") {
        item.el.style.visibility = "visible";
      }
    });
  }

  syncWithElements(elements: readonly ExcalidrawElement[]) {
    // Build a set of current overlay IDs from elements
    const currentOverlayIds = new Set<string>();
    elements.forEach((element) => {
      const overlayId = (element as any).customData?.overlayId as string | undefined;
      if (overlayId && !(element as any).isDeleted) {
        currentOverlayIds.add(overlayId);
      }
    });

    // Remove overlays that no longer exist in elements
    const toRemove: string[] = [];
    this.items.forEach((item, id) => {
      if (!currentOverlayIds.has(id)) {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => {
      const item = this.items.get(id);
      if (item) {
        item.el.remove();
        this.items.delete(id);
      }
    });
  }

  updateSelectionState(selectedElementIds: Record<string, boolean> | undefined) {
    this.items.forEach((item) => {
      const isSelected = selectedElementIds?.[item.id] ?? false;
      if (isSelected) {
        item.el.classList.add("overlay-selected");
        // Selected: Disable pointer events so Excalidraw can handle drag/resize/delete
        item.el.style.pointerEvents = "none";
      } else {
        item.el.classList.remove("overlay-selected");
        // Unselected: Enable pointer events so user can interact with content (e.g. play video)
        // User must use marquee selection (drag from outside) to select the element
        item.el.style.pointerEvents = "auto";
      }
    });
  }

  setReadOnly(readonly: boolean) {
    this.items.forEach((item) => {
      item.el.style.pointerEvents = readonly ? "none" : "auto";
    });
  }

  destroy() {
    this.items.forEach((item) => item.el.remove());
    this.items.clear();
  }
}

