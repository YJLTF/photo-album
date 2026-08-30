import { describe, it, expect } from "vitest";
import { getOverlayPositionStyle } from "../overlayPosition";

describe("getOverlayPositionStyle", () => {
  it("左上角：top 与 left 均为 20px", () => {
    expect(getOverlayPositionStyle("top-left")).toEqual({ top: "20px", left: "20px" });
  });

  it("右下角：bottom 与 right 均为 20px", () => {
    expect(getOverlayPositionStyle("bottom-right")).toEqual({ bottom: "20px", right: "20px" });
  });

  it("水平居中：left 50% 并配合 translateX 修正", () => {
    expect(getOverlayPositionStyle("bottom-center")).toEqual({
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
    });
    expect(getOverlayPositionStyle("top-center")).toEqual({
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
    });
  });

  it("正中央：水平垂直都居中，配合 translate 修正", () => {
    expect(getOverlayPositionStyle("center")).toEqual({
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    });
  });

  it("未知值安全回退（不抛错）", () => {
    expect(getOverlayPositionStyle("weird")).toBeDefined();
  });
});
