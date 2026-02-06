<template>
  <div class="app-root">
    <header class="app-toolbar">
      <div class="title-block">
        <p class="eyebrow">Vue Shell · React Kernel</p>
        <h1>Excalidraw Hybrid Studio</h1>
      </div>
    </header>

    <ExcalidrawWrapper
      :permissions="{ canEdit }"
      :actions="toolbarActions"
      @ready="onReady"
      @change="onChange"
      @snapshot="onSnapshot"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import ExcalidrawWrapper from "@/components/ExcalidrawWrapper.vue";
import eventBus from "@/utils/eventBus";
import { createId } from "@/utils/id";
import type { ActionItem } from "@/react/ExcalidrawHost";

const canEdit = ref(true);

const toggleEdit = () => {
  canEdit.value = !canEdit.value;
};

const onReady = () => {
  // Hook for API-ready events.
};

const onChange = () => {
  // Hook for element sync.
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
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    x: 140,
    y: -100,
    width: 320,
    height: 200,
  });
};

const addApp = () => {
  eventBus.emit("addExtraResource", {
    id: createId("overlay"),
    type: "app",
    url: "https://example.com",
    x: -140,
    y: 140,
    width: 360,
    height: 240,
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
</script>

