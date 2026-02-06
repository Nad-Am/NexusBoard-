import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "@excalidraw/excalidraw/index.css";
import "./styles/main.css";

const app = createApp(App);
app.use(createPinia());
app.mount("#app");
