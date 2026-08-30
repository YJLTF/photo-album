import path from "path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// 后端独立测试配置：阻断 vitest 向上解析到根目录的 vite.config.ts（其中的
// React/Babel 插件不适用于 Node 侧代码）。
// TypeORM 依赖装饰器元数据，esbuild 不支持 emitDecoratorMetadata，因此用 SWC 转换。
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 20000,
    pool: "forks",
  },
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2020",
        baseUrl: path.join(__dirname, "src"),
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
