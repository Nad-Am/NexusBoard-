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
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 0,
    groupIds: [],
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    isDeleted: false,
    boundElements: null,
    locked: true,
    link: null,
    updated: Date.now(),
    roundness: null,
    index: null,
    frameId: null,
    customData: {
      overlayId: resource.id,
      overlayType: resource.type,
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
      el.style.pointerEvents = "auto";

      this.root.appendChild(el);
      this.items.set(resource.id, { id: resource.id, type: resource.type, el });
      elements.push(createPlaceholderElement(resource));
    });

    return { elements };
  }

  updatePositions(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    container: HTMLElement,
  ) {
    const zoom = appState.zoom?.value ?? 1;
    const scrollX = appState.scrollX ?? 0;
    const scrollY = appState.scrollY ?? 0;
    const rect = container.getBoundingClientRect();
    const offsetX = rect.width / 2;
    const offsetY = rect.height / 2;

    elements.forEach((element) => {
      const overlayId = (element as any).customData?.overlayId as string | undefined;
      if (!overlayId) return;

      const item = this.items.get(overlayId);
      if (!item) return;

      const x = (element.x + scrollX) * zoom + offsetX;
      const y = (element.y + scrollY) * zoom + offsetY;
      const width = element.width * zoom;
      const height = element.height * zoom;

      item.el.style.transform = `translate(${x}px, ${y}px)`;
      item.el.style.width = `${width}px`;
      item.el.style.height = `${height}px`;
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

