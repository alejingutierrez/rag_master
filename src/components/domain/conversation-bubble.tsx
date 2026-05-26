"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface ConversationBubbleProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Quien envió el mensaje. */
  from: "user" | "assistant";
  /** Si está streaming, muestra caret. */
  streaming?: boolean;
}

/**
 * ConversationBubble — un mensaje del chat.
 *
 * - `user`: alineado derecha, con bubble bg muted.
 * - `assistant`: full width, prose académica, sin bubble.
 */
export const ConversationBubble = forwardRef<
  HTMLDivElement,
  ConversationBubbleProps
>(({ className, from, streaming, children, ...props }, ref) => {
  if (from === "user") {
    return (
      <div
        ref={ref}
        className={cn("flex justify-end my-4", className)}
        {...props}
      >
        <div
          className={cn(
            "max-w-[600px] px-4 py-3",
            "bg-[var(--bg-hover)] text-[var(--fg-default)]",
            "rounded-xl rounded-br-md",
            "text-[15px] leading-relaxed",
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn("my-6 max-w-[var(--container-reading)]", className)}
      {...props}
    >
      <div className="prose-academic max-w-none">
        {children}
        {streaming && <span className="stream-caret" aria-hidden />}
      </div>
    </div>
  );
});
ConversationBubble.displayName = "ConversationBubble";
