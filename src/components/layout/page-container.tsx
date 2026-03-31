import { cn } from "@/lib/utils";

const maxWidthMap = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  full: "max-w-full",
} as const;

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: keyof typeof maxWidthMap;
  className?: string;
}

export function PageContainer({ children, maxWidth = "lg", className }: PageContainerProps) {
  return (
    <div className={cn("px-6 py-6 md:px-8 md:py-8 mx-auto w-full", maxWidthMap[maxWidth], className)}>
      {children}
    </div>
  );
}
