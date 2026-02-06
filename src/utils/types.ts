export type WorkspacePermissions = {
  canEdit: boolean;
};

export type ExtraResource = {
  id: string;
  type: "image" | "markdown" | "video" | "app";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  content?: string;
  url?: string;
  file?: File;
};
