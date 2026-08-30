import type { CSSProperties } from "react";

/**
 * 轮播叠加文字位置 -> 样式映射（纯函数，便于测试）。
 * position 形如 top-left / center / bottom-right。
 */
export const getOverlayPositionStyle = (position: string): CSSProperties => {
  const vertical = position.startsWith("top")
    ? "top"
    : position.startsWith("bottom")
      ? "bottom"
      : "top";
  const horizontal = position.endsWith("left")
    ? "left"
    : position.endsWith("right")
      ? "right"
      : "center";

  const style: CSSProperties = { [vertical]: "20px" };
  if (horizontal === "center") {
    style.left = "50%";
    style.transform = "translateX(-50%)";
  } else {
    style[horizontal] = "20px";
  }
  return style;
};
