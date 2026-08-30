import type { PermissionLevel, TransitionEffect } from "./api";

// 标签创建时自动从调色板分配颜色（Home / Tags 页共用）
export const TAG_COLORS = ["#E8845C", "#5CE8A0", "#5CA8E8", "#E85CA0", "#A05CE8", "#E8D45C"];

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  viewer: "浏览者",
  editor: "编辑者",
  admin: "管理员",
};

// 侧栏用纯文字色，卡片用带背景的徽章色
export const PERMISSION_TEXT_COLORS: Record<PermissionLevel, string> = {
  viewer: "text-blue-400",
  editor: "text-green-400",
  admin: "text-orange-400",
};

export const PERMISSION_BADGE_COLORS: Record<PermissionLevel, string> = {
  viewer: "bg-blue-500/20 text-blue-400",
  editor: "bg-green-500/20 text-green-400",
  admin: "bg-orange-500/20 text-orange-400",
};

export const EFFECT_LABELS: Record<TransitionEffect, string> = {
  fade: "淡入淡出",
  slide: "滑动",
  zoom: "缩放",
  flip: "翻转",
  blur: "模糊",
};
