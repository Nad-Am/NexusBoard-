import mitt from "mitt";
import type { ExtraResource } from "./types";

export type Events = {
  addExtraResource: ExtraResource;
};

const eventBus = mitt<Events>();

export default eventBus;
