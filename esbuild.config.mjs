import esbuild from "esbuild";
import process from "node:process";
import { builtinModules } from "node:module";
import { copyFile, mkdir } from "node:fs/promises";

const production = process.argv[2] === "production";
const outputDirectory = "dist/link-tree";

const copyPluginFiles = {
  name: "copy-plugin-files",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) return;
      await mkdir(outputDirectory, { recursive: true });
      await Promise.all(
        ["manifest.json", "styles.css"].map((file) =>
          copyFile(file, `${outputDirectory}/${file}`),
        ),
      );
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
  ],
  format: "cjs",
  target: "es2021",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  outfile: `${outputDirectory}/main.js`,
  minify: production,
  plugins: [copyPluginFiles],
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}

