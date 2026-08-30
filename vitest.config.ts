import { defineConfig } from "vitest/config";

// 前端测试范围限定在 src/：根目录运行 vitest 时不要扫到 backend/（后端有独立的
// vitest 配置与 SWC 转换链，见 backend/vitest.config.ts）
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
