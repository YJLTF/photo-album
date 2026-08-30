import type { CSSProperties } from "react";

/**
 * 轮播叠加文字位置 -> 样式映射（纯函数，便于测试）。
 * position 形如 top-left / center / bottom-right。
 * "center" 是真正的正中央（水平垂直都居中）；
 * 其余以 20px 边距贴边，水平/垂直居中只居中所在轴。
 */
export const getOverlayPositionStyle = (position: string): CSSProperties => {
  // 正中央单独处理：两个方向都要居中
  if (position === "center") {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

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
