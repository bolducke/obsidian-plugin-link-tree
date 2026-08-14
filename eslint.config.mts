import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  globalIgnores([
    "node_modules",
    "coverage",
    "dist",
    "package-lock.json",
    "versions.json",
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "eslint.config.mts",
            "esbuild.config.mjs",
            "version-bump.mjs",
            "vitest.config.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["esbuild.config.mjs", "version-bump.mjs", "vitest.config.ts"],
    rules: {
      // These files execute in Node during development and are never bundled.
      "obsidianmd/no-nodejs-modules": "off",
    },
  },
  {
    files: ["src/settings.ts"],
    rules: {
      // The imperative API supports the plugin's current minimum Obsidian version.
      "@typescript-eslint/no-deprecated": "off",
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
    },
  },
);
