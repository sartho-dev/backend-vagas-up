import { defineConfig } from "vitest/config";
import path from "node:path";

// Avoid using import.meta (requires specific TS module setting). Use cwd as base.
const __dirname = process.cwd();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup/env.ts"],
    globalSetup: ["./test/setup/global-setup.ts"],
    testTimeout: 15000,
    // Todos os arquivos compartilham um unico banco e cada um faz TRUNCATE no
    // beforeEach. Em paralelo, um worker apaga os dados que o outro acabou de
    // criar. Serializar os arquivos e o que mantem o isolamento.
    fileParallelism: false,
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
