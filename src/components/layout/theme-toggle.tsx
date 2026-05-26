"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  IconButton,
  Tooltip,
} from "@/components/ui";

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Placeholder antes del mount para evitar hydration mismatch.
  if (!mounted) {
    return <div className="size-8" aria-hidden />;
  }

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Tooltip content="Tema">
          <IconButton aria-label="Cambiar tema" variant="ghost">
            <Icon />
          </IconButton>
        </Tooltip>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setMode("light")}>
          <Sun /> Claro
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setMode("dark")}>
          <Moon /> Oscuro
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setMode("auto")}>
          <Monitor /> Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
