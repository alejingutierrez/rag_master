"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/utils";

interface DropzoneProps {
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  onClear: () => void;
}

export function Dropzone({ onFilesSelect, selectedFiles, onRemoveFile, onClear }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === "application/pdf"
      );
      if (files.length > 0) {
        onFilesSelect(files);
      }
    },
    [onFilesSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) onFilesSelect(files);
      e.target.value = "";
    },
    [onFilesSelect]
  );

  return (
    <div className="space-y-3">
      <label
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-border-hover hover:bg-surface-hover"
        )}
      >
        <Upload className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-lg font-medium text-foreground">
          Arrastra tus PDFs aqui
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          o haz clic para seleccionar archivos (puedes seleccionar varios)
        </p>
        <p className="text-xs text-muted-foreground/60 mt-2">Solo archivos PDF</p>
        <input
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </label>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {selectedFiles.length} archivo{selectedFiles.length > 1 ? "s" : ""} seleccionado{selectedFiles.length > 1 ? "s" : ""}
            </p>
            <button
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Limpiar todo
            </button>
          </div>
          {selectedFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="border border-border rounded-lg px-4 py-3 flex items-center justify-between bg-surface"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onRemoveFile(i)}
                className="h-7 w-7 rounded-full hover:bg-surface-hover flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
