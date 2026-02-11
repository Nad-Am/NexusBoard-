import type { AppState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExtraResource } from "./types";
import { type App, type Component, createApp, nextTick } from "vue";
import html2canvas from "html2canvas";
import { createId } from "./id";

const DEFAULT_SIZE = 320;

type SnapshotHandler = (id: string, dataURL: string) => void;

type OverlayItem = {
  id: string;
  type: ExtraResource["type"];
  el: HTMLElement;
  vueApp?: App; // Store Vue app instance for cleanup
  interactive?: boolean;
};

const createPlaceholderElement = (resource: ExtraResource): ExcalidrawElement => {
  const width = resource.width ?? DEFAULT_SIZE;
  const height = resource.height ?? DEFAULT_SIZE;

  return {
    id: resource.id,
    type: "image", // Changed from "rectangle" to "image" to support snapshots
    x: resource.x ?? 0,
    y: resource.y ?? 0,
    width,
    height,
    angle: 0,
    strokeColor: "transparent", // Transparent stroke for cleaner look
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
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
    index: null,
    frameId: null,
    fileId: createId("file") as string, // Generate fileId so snapshot can attach to it
    status: "saved",
    scale: [1, 1],
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
  return el;
};

export default class OverlayManager {
  private root: HTMLElement;
  private activeOverlays = new Map<string, OverlayItem>();
  private pendingRemovals = new Map<string, OverlayItem>();
  private componentRegistry: Record<string, Component> = {};
  private onSnapshot?: SnapshotHandler;
  private currentZoom = 1;
  private readOnly = false;

  constructor(root: HTMLElement, componentRegistry: Record<string, Component> = {}, onSnapshot?: SnapshotHandler) {
    this.root = root;
    this.componentRegistry = componentRegistry;
    this.onSnapshot = onSnapshot;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    window.addEventListener("dblclick", this.handleDoubleClick, { capture: true });
  }

  private handleDoubleClick = (e: MouseEvent) => {
    // Find if any active overlay is under the mouse
    const x = e.clientX;
    const y = e.clientY;

    for (const [id, item] of this.activeOverlays) {
      const rect = item.el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        // Activate interaction!
        e.stopPropagation(); // Stop Excalidraw from seeing this double-click (prevent text edit)
        e.preventDefault();
        this.toggleInteraction(id);
        return;
      }
    }
  };

  private setInteraction(id: string, interactive: boolean) {
    const item = this.activeOverlays.get(id);
    if (!item) return;

    const canInteract = interactive && !this.readOnly;
    item.interactive = canInteract;
    item.el.style.pointerEvents = canInteract ? "auto" : "none";
    item.el.style.borderColor = canInteract ? "#10b981" : ""; // Green when interactive
    item.el.classList.toggle("overlay-selected", canInteract);
  }

  private toggleInteraction(id: string) {
    const item = this.activeOverlays.get(id);
    if (!item) return;
    this.setInteraction(id, !item.interactive);
  }
  // Helper to create element configuration, but DOES NOT mount DOM
  batchCreateOverlays(resources: ExtraResource[]) {
    const elements: ExcalidrawElement[] = [];

    resources.forEach((resource) => {
      elements.push(createPlaceholderElement(resource));
    });

    return { elements };
  }

  // Recreates overlays only if they are selected
  recreateOverlayFromElement(element: ExcalidrawElement) {
    // This method might be less relevant now as we spawn on selection,
    // but can be used to restore state if needed.
    // For now, we rely on updateSelectionState to spawn.
  }

  updatePositions(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    container: HTMLElement,
  ) {
    const zoom = appState.zoom?.value ?? 1;
    this.currentZoom = zoom;
    const scrollX = appState.scrollX ?? 0;
    const scrollY = appState.scrollY ?? 0;

    const excalidrawCanvas = container.querySelector("canvas.excalidraw__canvas");
    const containerRect = container.getBoundingClientRect();

    let canvasOffsetX = 0;
    let canvasOffsetY = 0;

    if (excalidrawCanvas) {
      const canvasRect = excalidrawCanvas.getBoundingClientRect();
      canvasOffsetX = canvasRect.left - containerRect.left;
      canvasOffsetY = canvasRect.top - containerRect.top;
    }

    // Only update positions for valid, active overlays
    this.activeOverlays.forEach((item, id) => {
      const element = elements.find((e) => e.id === id);
      if (!element || element.isDeleted) {
        this.removeOverlay(id);
        return;
      }

      const viewportX = (element.x + scrollX) * zoom + canvasOffsetX;
      const viewportY = (element.y + scrollY) * zoom + canvasOffsetY;

      item.el.style.transform = `translate(${viewportX}px, ${viewportY}px) scale(${zoom})`;
      item.el.style.width = `${element.width}px`;
      item.el.style.height = `${element.height}px`;
    });
  }

  // The core logic: Mount DOM if selected, Unmount if deselected
  updateSelectionState(selectedElementIds: Record<string, boolean> | undefined, elements: readonly ExcalidrawElement[]) {
    const selectedIds = selectedElementIds
      ? Object.keys(selectedElementIds).filter((id) => selectedElementIds[id])
      : [];

    // 1. Mount Overlays for newly selected supported elements
    selectedIds.forEach((id) => {
      if (this.activeOverlays.has(id)) return; // Already active

      const element = elements.find((e) => e.id === id);
      if (!element || element.isDeleted) return;

      const customData = (element as any).customData;
      if (!customData?.overlayId || !customData?.overlayType) return;

      // It's a supported overlay element, and it is selected. Mount it!
      this.mountOverlay(element, customData);
    });

    // 2. Unmount Overlays for elements that are no longer selected
    // Create a set for O(1) lookup
    const selectedIdSet = new Set(selectedIds);
    
    // We iterate over keys(activeOverlays) by creating an array first to avoid modification issues
    const activeIds = Array.from(this.activeOverlays.keys());
    for (const activeId of activeIds) {
      if (!selectedIdSet.has(activeId)) {
        // If deselected, remove it. 
        // We act synchronously-ish here, but removeOverlay is async now.
        // We don't await strictly to avoid UI blocking? 
        // ACTUALLY, if we don't await, the element might be removed before snapshot?
        // Wait, removeOverlay has `await html2canvas` THEN `el.remove()`.
        // So if we don't await removeOverlay calls, the snapshot runs while EL is still there.
        // Then EL is removed.
        // This is safe!
        this.removeOverlay(activeId);
      }
    }

    // Note: We don't need to update positions here, the next animation frame (or user interaction) will do it
  }

  private mountOverlay(element: ExcalidrawElement, customData: any) {
    // Check if we can resurrect a pending removal
    if (this.pendingRemovals.has(element.id)) {
      const item = this.pendingRemovals.get(element.id)!;
      this.pendingRemovals.delete(element.id);
      // 重置淡出效果
      item.el.style.transition = "";
      item.el.style.opacity = "1";
      item.el.style.visibility = "visible";
      item.interactive = false;
      item.el.style.pointerEvents = "none";
      item.el.classList.remove("overlay-selected");
      this.activeOverlays.set(element.id, item);
      return;
    }

    const resource: ExtraResource = {
      id: customData.overlayId,
      type: customData.overlayType,
      content: customData.overlayContent,
      url: customData.overlayUrl,
      // Dimensions will be set by updatePositions
    };

    let el: HTMLElement;
    let vueApp: App | undefined;

    // Check if it's a registered Vue component
    if (this.componentRegistry[customData.overlayType]) {
      const Component = this.componentRegistry[customData.overlayType];
      el = document.createElement("div");
      el.classList.add("overlay-item", `overlay-${customData.overlayType}`);
      // Mount Vue App
      vueApp = createApp(Component);
      vueApp.mount(el);
    } else {
      // Fallback to standard DOM creation
      el = createOverlayNode(resource);
    }

    el.style.position = "absolute";
    el.style.left = "0";
    el.style.top = "0";
    el.style.transformOrigin = "top left";
    // Default to strict "none" so we can move/resize the Excalidraw element by default.
    // User must hold Ctrl to interact (implemented in event listeners)
    el.style.pointerEvents = "none"; 
    
    this.root.appendChild(el);
    this.activeOverlays.set(element.id, { id: element.id, type: resource.type, el, vueApp, interactive: false });
  }

  private async removeOverlay(id: string) {
    const item = this.activeOverlays.get(id);
    if (!item) return;

    // Move to pending removals (but keep visible for snapshot)
    this.activeOverlays.delete(id);
    this.pendingRemovals.set(id, item);
    item.interactive = false;
    item.el.style.pointerEvents = "none";
    item.el.classList.remove("overlay-selected");

    // Wait for Vue updates and ensure browser repaint/reflow
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Capture snapshot BEFORE hiding
    if (this.onSnapshot) {
      try {
        // 使用 Excalidraw 元素的精确尺寸（从 style 获取）
        const captureWidth = Math.round(parseFloat(item.el.style.width) || item.el.offsetWidth || 320);
        const captureHeight = Math.round(parseFloat(item.el.style.height) || item.el.offsetHeight || 240);
        
        // 保存原始 transform（包含 translate 和 scale）
        const originalTransform = item.el.style.transform;
        
        // 临时移除 scale，只保留位置（或直接重置为简单状态）
        // 截图时不需要位置偏移，只需要内容
        item.el.style.transform = "none";
        
        console.log("[Snapshot] Capture size:", captureWidth, captureHeight);

        // 截图，scale: 1 保持 1:1 像素比例
        const canvas = await html2canvas(item.el, { 
          logging: false, 
          useCORS: true, 
          backgroundColor: null,
          scale: 1,
          width: captureWidth,
          height: captureHeight,
        });
        
        // 恢复原始 transform
        item.el.style.transform = originalTransform;
        
        const dataURL = canvas.toDataURL("image/png");
        
        // Only update if still pending removal (otherwise we resurrected)
        if (this.pendingRemovals.has(id)) {
          this.onSnapshot(id, dataURL);
          // 等待 Excalidraw 加载新图片后再隐藏 overlay
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      } catch (e) {
        console.error("Snapshot failed:", e);
      }
    }

    // Check if still pending (might have been resurrected)
    if (!this.pendingRemovals.has(id)) {
      return;
    }

    // 使用淡出效果避免闪烁
    item.el.style.transition = "opacity 200ms ease-out";
    item.el.style.opacity = "0";
    
    // 等待淡出完成后再清理
    await new Promise((resolve) => setTimeout(resolve, 250));

    if (item.vueApp) {
      item.vueApp.unmount();
    }
    item.el.remove();
    this.pendingRemovals.delete(id);
  }

  syncWithElements(elements: readonly ExcalidrawElement[]) {
      // Just cleanup deleted elements
      elements.forEach(el => {
          if (el.isDeleted && this.activeOverlays.has(el.id)) {
              this.removeOverlay(el.id);
          }
      });
  }

  setReadOnly(readonly: boolean) {
     // In this hybrid mode, readonly might mean strictly no interaction,
     // or just "cannot move". 
     // For now, if readonly, we might want to disable pointer events on active overlays
     this.readOnly = readonly;
     this.activeOverlays.forEach(item => {
         item.interactive = readonly ? false : item.interactive;
         item.el.style.pointerEvents = readonly ? "none" : (item.interactive ? "auto" : "none");
     });
  }

  destroy() {
    window.removeEventListener("dblclick", this.handleDoubleClick, { capture: true });
    this.activeOverlays.forEach((item) => {
      if (item.vueApp) item.vueApp.unmount();
      item.el.remove();
    });
    this.activeOverlays.clear();
  }
}
