"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/utils";

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
}

export function Dropzone({ onFileSelect, selectedFile, onClear }: DropzoneProps) {
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
      const file = e.dataTransfer.files[0];
      if (file?.type === "application/pdf") {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  if (selectedFile) {
    return (
      <div className="border-2 border-green-200 bg-green-50 rounded-xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
            <FileText className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-neutral-900">{selectedFile.name}</p>
            <p className="text-sm text-neutral-500">{formatBytes(selectedFile.size)}</p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="h-8 w-8 rounded-full hover:bg-green-100 flex items-center justify-center transition-colors"
        >
          <X className="h-4 w-4 text-neutral-500" />
        </button>
      </div>
    );
  }

  return (
    <label
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors",
        isDragging
          ? "border-neutral-900 bg-neutral-50"
          : "border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50"
      )}
    >
      <Upload className="h-10 w-10 text-neutral-400 mb-4" />
      <p className="text-lg font-medium text-neutral-700">
        Arrastra tu PDF aqui
      </p>
      <p className="text-sm text-neutral-500 mt-1">
        o haz clic para seleccionar un archivo
      </p>
      <p className="text-xs text-neutral-400 mt-3">Solo archivos PDF</p>
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileInput}
      />
    </label>
  );
}
