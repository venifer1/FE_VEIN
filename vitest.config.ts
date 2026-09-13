import path from "node:path";
import { defineConfig } from "vitest/config";

// FE 단위 테스트(R122~). tsconfig의 "@/*" -> "./*" alias를 vitest에서도 해석하도록 매핑해
// aliased 모듈(@/store, @/lib 등)도 테스트할 수 있게 한다. 기본 node 환경(순수 로직 위주).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "store/**/*.test.ts"],
  },
});
