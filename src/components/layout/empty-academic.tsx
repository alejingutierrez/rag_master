"use client";

import { theme, Typography } from "antd";
import type { ReactNode } from "react";

const { Text } = Typography;

/**
 * Empty state coherente con el tono académico. Reemplaza
 * <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> en toda la app.
 */
export function EmptyAcademic({
  title,
  description,
  action,
  icon,
  size = "default",
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  size?: "small" | "default" | "large";
}) {
  const { token } = theme.useToken();
  const pad = size === "small" ? 24 : size === "large" ? 60 : 40;
  const iconSize = size === "small" ? 36 : size === "large" ? 64 : 48;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: pad,
        gap: 12,
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          width: iconSize + 24,
          height: iconSize + 24,
          borderRadius: 16,
          background: token.colorFillQuaternary,
          border: `1px dashed ${token.colorBorderSecondary}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: token.colorTextTertiary,
          fontSize: iconSize * 0.55,
        }}
      >
        {icon ?? <BookGlyph />}
      </div>
      {title && (
        <Text
          strong
          style={{
            fontSize: size === "small" ? 13 : 15,
            color: token.colorText,
            fontFamily: "var(--font-serif)",
          }}
        >
          {title}
        </Text>
      )}
      {description && (
        <Text
          style={{
            fontSize: size === "small" ? 12 : 13,
            color: token.colorTextTertiary,
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          {description}
        </Text>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

function BookGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 5a2 2 0 0 1 2-2h11v15H6a2 2 0 0 0-2 2V5Z" />
      <path d="M4 20a2 2 0 0 0 2 2h11" />
      <path d="M9 7h5" />
      <path d="M9 10h5" />
    </svg>
  );
}
