<template>
  <div class="excalidraw-wrapper" :class="{ readonly: !permissions.canEdit }">
    <div ref="excalidrawContainer" class="excalidraw-container"></div>
    <div ref="overlayRoot" class="excalidraw-overlay-root"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { exportToCanvas } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useCanvasStore, mergeElements } from "@/stores/canvasStore";
import OverlayManager from "@/utils/overlayManager";
import eventBus from "@/utils/eventBus";
import { createId } from "@/utils/id";
import type { ExtraResource, WorkspacePermissions } from "@/utils/types";
import ExcalidrawHost, { type ActionItem } from "@/react/ExcalidrawHost";
import { useDomListener } from "@/utils/domListener";

const props = withDefaults(
  defineProps<{
    permissions?: WorkspacePermissions;
    langCode?: string;
    actions?: ActionItem[];
  }>(),
  {
    permissions: () => ({ canEdit: true }),
    langCode: "zh-CN",
    actions: () => [],
  },
);

const emit = defineEmits<{
  ready: [api: ExcalidrawImperativeAPI];
  change: [elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles];
  snapshot: [blob: Blob];
  pointer: [payload: unknown];
}>();

const permissions = computed(() => props.permissions ?? { canEdit: true });
const excalidrawContainer = ref<HTMLDivElement | null>(null);
const overlayRoot = ref<HTMLDivElement | null>(null);
const reactRoot = ref<Root | null>(null);
const excalidrawAPI = ref<ExcalidrawImperativeAPI | null>(null);
const overlayManager = ref<OverlayManager | null>(null);
const canvasStore = useCanvasStore();
const isFirstLoad = ref(true);
let snapshotTimer: number | null = null;
let stopDomListener: (() => void) | null = null;
let resourceHandler: ((resource: ExtraResource) => void) | null = null;
let rafId: number | null = null;

const handlePointerUpdate = (payload: unknown) => {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    if (!excalidrawAPI.value || !overlayManager.value || !excalidrawContainer.value) return;
    overlayManager.value.updatePositions(
      excalidrawAPI.value.getSceneElements(),
      excalidrawAPI.value.getAppState(),
      excalidrawContainer.value,
    );
  });
  emit("pointer", payload);
};

const handleChange = (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
  const validFiles = Object.fromEntries(
    Object.entries(files).filter(([, file]) => Boolean(file)),
  ) as BinaryFiles;

  canvasStore.setElements(elements);
  canvasStore.setAppState(appState);
  canvasStore.setFiles(validFiles);

  if (excalidrawContainer.value && overlayManager.value) {
    // Sync overlay DOM with elements (handle deletions)
    overlayManager.value.syncWithElements(elements);
    // Update overlay positions
    overlayManager.value.updatePositions(elements, appState, excalidrawContainer.value);
    // Update selection highlighting
    overlayManager.value.updateSelectionState(appState.selectedElementIds);
  }

  if (isFirstLoad.value) isFirstLoad.value = false;
  emit("change", elements, appState, validFiles);
};

const handleReady = (api: ExcalidrawImperativeAPI) => {
  excalidrawAPI.value = api;
  emit("ready", api);
};

const toDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const addImageResource = async (resource: ExtraResource) => {
  if (!excalidrawAPI.value || !resource.file) return;

  const dataURL = await toDataURL(resource.file);
  const fileId = createId("file");

  const fileData = {
    id: fileId,
    dataURL,
    mimeType: resource.file.type || "image/png",
    created: Date.now(),
  };

  excalidrawAPI.value.addFiles({ [fileId]: fileData } as any);

  const imageElement = {
    id: createId("image"),
    type: "image",
    x: resource.x ?? 0,
    y: resource.y ?? 0,
    width: resource.width ?? 320,
    height: resource.height ?? 240,
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    isDeleted: false,
    boundElements: null,
    locked: true,
    link: null,
    updated: Date.now(),
    fileId,
    scale: [1, 1],
    index: null,
    frameId: null,
    roundness: null,
    status: "saved",
  } as any as ExcalidrawElement;

  const nextElements = [...excalidrawAPI.value.getSceneElements(), imageElement];
  excalidrawAPI.value.updateScene(
    { elements: nextElements, captureUpdate: "NEVER" },
  );
};

const renderReact = () => {
  if (!reactRoot.value) return;

  reactRoot.value.render(
    React.createElement(ExcalidrawHost, {
      initialData: {
        elements: canvasStore.elements,
        appState: canvasStore.appState,
        files: canvasStore.files,
      },
      onChange: handleChange,
      onReady: handleReady,
      onPointerUpdate: handlePointerUpdate,
      generateIdForFile: () => createId("file"),
      langCode: props.langCode,
      viewModeEnabled: !permissions.value.canEdit,
      zenModeEnabled: false,
      actions: props.actions,
    }),
  );
};

const handleAddResource = async (resource: ExtraResource) => {
  if (!excalidrawAPI.value || !overlayManager.value) return;

  if (resource.type === "image") {
    await addImageResource(resource);
    return;
  }

  const { elements } = overlayManager.value.batchCreateOverlays([resource]);
  const merged = mergeElements(excalidrawAPI.value.getSceneElements(), elements);

  excalidrawAPI.value.updateScene(
    { elements: merged, captureUpdate: "NEVER" },
  );

  if (excalidrawContainer.value) {
    overlayManager.value.updatePositions(merged, excalidrawAPI.value.getAppState(), excalidrawContainer.value);
  }
};

const startSnapshotPolling = () => {
  if (snapshotTimer) return;
  snapshotTimer = window.setInterval(async () => {
    if (!excalidrawAPI.value || !permissions.value.canEdit || isFirstLoad.value) return;

    const elements = excalidrawAPI.value.getSceneElements();
    const appState = excalidrawAPI.value.getAppState();
    const files = (excalidrawAPI.value as any).getFiles?.() ?? {};

    const canvas = await exportToCanvas({
      elements,
      appState,
      files,
    } as any);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png", 0.7),
    );

    if (blob) emit("snapshot", blob);
  }, 30000);
};

onMounted(() => {
  if (!excalidrawContainer.value) return;
  if (!overlayRoot.value) return;

  overlayManager.value = new OverlayManager(overlayRoot.value);
  overlayManager.value.setReadOnly(!permissions.value.canEdit);

  reactRoot.value = createRoot(excalidrawContainer.value);
  renderReact();

  startSnapshotPolling();

  stopDomListener = useDomListener(".panelColumn", () => {
    if (!excalidrawContainer.value) return;
    excalidrawContainer.value.classList.add("panel-active");
  });

  resourceHandler = (resource: ExtraResource) => {
    void handleAddResource(resource);
  };
  eventBus.on("addExtraResource", resourceHandler);
});

watch(
  () => canvasStore.serverElements,
  (newElements) => {
    if (!excalidrawAPI.value) return;

    // Recreate any missing overlay DOM nodes from synced elements
    if (overlayManager.value) {
      newElements.forEach((element) => {
        overlayManager.value!.recreateOverlayFromElement(element);
      });
    }

    if (isFirstLoad.value) {
      excalidrawAPI.value.updateScene(
        { elements: newElements, captureUpdate: "NEVER" },
      );
      isFirstLoad.value = false;

      // Update overlay positions after first load
      if (overlayManager.value && excalidrawContainer.value) {
        overlayManager.value.updatePositions(
          newElements,
          excalidrawAPI.value.getAppState(),
          excalidrawContainer.value,
        );
      }
      return;
    }

    const merged = mergeElements(excalidrawAPI.value.getSceneElements(), newElements);
    excalidrawAPI.value.updateScene(
      { elements: merged, captureUpdate: "NEVER" },
    );

    // Update overlay positions after merge
    if (overlayManager.value && excalidrawContainer.value) {
      overlayManager.value.updatePositions(
        merged,
        excalidrawAPI.value.getAppState(),
        excalidrawContainer.value,
      );
    }
  },
  { deep: true },
);

watch(
  () => canvasStore.serverFiles,
  (files) => {
    if (!excalidrawAPI.value) return;
    excalidrawAPI.value.addFiles(files as any);
  },
  { deep: true },
);

watch(
  () => canvasStore.serverAppState,
  (appState) => {
    if (!excalidrawAPI.value) return;
    excalidrawAPI.value.updateScene({
      appState,
      captureUpdate: "NEVER",
    });
  },
  { deep: true },
);

watch(
  () => permissions.value.canEdit,
  (canEdit) => {
    overlayManager.value?.setReadOnly(!canEdit);

    if (!excalidrawContainer.value) return;
    if (canEdit) {
      excalidrawContainer.value.classList.remove("edit-disabled");
    } else {
      excalidrawContainer.value.classList.add("edit-disabled");
    }

    renderReact();
  },
  { immediate: true },
);

onUnmounted(() => {
  if (resourceHandler) eventBus.off("addExtraResource", resourceHandler);
  resourceHandler = null;

  if (stopDomListener) stopDomListener();
  stopDomListener = null;

  if (reactRoot.value) {
    reactRoot.value.unmount();
    reactRoot.value = null;
  }

  if (snapshotTimer) {
    window.clearInterval(snapshotTimer);
    snapshotTimer = null;
  }

  overlayManager.value?.destroy();
  overlayManager.value = null;
});
</script>

<style scoped>
.excalidraw-wrapper {
  position: fixed;
  top: 120px;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  max-width: 100vw;
  overflow: hidden;
}

.excalidraw-container,
.excalidraw-overlay-root {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.excalidraw-overlay-root {
  pointer-events: none;
  z-index: 5;
}

.excalidraw-overlay-root .overlay-item {
  pointer-events: auto;
  backdrop-filter: blur(6px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(12, 12, 14, 0.6);
  color: #f4f4f5;
  font-size: 14px;
  line-height: 1.4;
  padding: 12px;
  overflow: hidden;
}

.excalidraw-overlay-root .overlay-video,
.excalidraw-overlay-root .overlay-image,
.excalidraw-overlay-root .overlay-app {
  padding: 0;
  background: rgba(12, 12, 14, 0.4);
}

.readonly .excalidraw-container {
  pointer-events: none;
}

.excalidraw-overlay-root .overlay-selected {
  border: 2px solid #6366f1 !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3), 0 4px 12px rgba(99, 102, 241, 0.25);
}

</style>
