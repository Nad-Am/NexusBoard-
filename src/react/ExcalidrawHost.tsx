import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export type ActionItem = {
  id: string;
  label: string;
  onClick: () => void;
  primary?: boolean;
  fileInput?: boolean;
  accept?: string;
  onFileChange?: (file: File) => void;
};

type Props = {
  initialData: {
    elements: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
    files?: BinaryFiles;
  };
  onChange: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => void;
  onReady?: (api: ExcalidrawImperativeAPI) => void;
  onPointerUpdate?: (payload: unknown) => void;
  generateIdForFile?: (file: File) => string;
  langCode?: string;
  viewModeEnabled?: boolean;
  zenModeEnabled?: boolean;
  actions?: ActionItem[];
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 500,
  transition: "all 0.2s ease",
};

const defaultButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "rgba(255, 255, 255, 0.1)",
  color: "#e4e4e7",
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
  color: "#fff",
};

const fileInputStyle: React.CSSProperties = {
  ...defaultButtonStyle,
  display: "inline-block",
};

const ExcalidrawHost: React.FC<Props> = ({
  initialData,
  onChange,
  onReady,
  onPointerUpdate,
  generateIdForFile,
  langCode,
  viewModeEnabled,
  zenModeEnabled,
  actions = [],
}) => {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  useEffect(() => {
    if (!apiRef.current || !onReady) return;
    onReady(apiRef.current);
  }, [onReady]);

  // Memoize action IDs to detect actual changes
  const actionIds = useMemo(
    () => actions.map((a) => `${a.id}:${a.label}`).join(","),
    [actions]
  );

  const renderActions = useCallback(() => {
    if (!actions.length) return null;

    return (
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {actions.map((action) => {
          if (action.fileInput) {
            return (
              <label key={action.id} style={fileInputStyle}>
                <input
                  type="file"
                  accept={action.accept || "*/*"}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && action.onFileChange) {
                      action.onFileChange(file);
                    }
                    e.target.value = "";
                  }}
                />
                {action.label}
              </label>
            );
          }

          return (
            <button
              key={action.id}
              onClick={action.onClick}
              style={action.primary ? primaryButtonStyle : defaultButtonStyle}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionIds]);

  const handleExcalidrawAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
    onReady?.(api);
  }, [onReady]);

  return (
    <Excalidraw
      excalidrawAPI={handleExcalidrawAPI}
      initialData={initialData}
      onChange={onChange}
      onPointerUpdate={onPointerUpdate}
      generateIdForFile={generateIdForFile}
      langCode={langCode}
      viewModeEnabled={viewModeEnabled}
      zenModeEnabled={zenModeEnabled}
      renderTopRightUI={renderActions}
      UIOptions={{
        canvasActions: {
          loadScene: true,
        },
      }}
      libraryReturnUrl=""
      onLibraryChange={() => {}}
    />
  );
};

export default ExcalidrawHost;

