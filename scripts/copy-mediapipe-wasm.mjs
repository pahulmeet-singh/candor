// Copies MediaPipe's WebAssembly runtime out of node_modules into public/mediapipe/wasm.
//
// The camera check in an ASSESSMENT runs MediaPipe's face detector inside the candidate's browser.
// Its JavaScript comes from the npm package (so it is bundled and version-locked), but it also needs
// a few .wasm files at runtime. Serving those from this app's own origin means they are exactly the
// same version as the JavaScript, work offline once cached, and need no third-party CDN.
//
// Runs from `postinstall`. If the package is missing it only warns and exits 0: the interview still
// works, and the camera check reports "camera not available" instead of failing the whole install.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const target = join(root, "public", "mediapipe", "wasm");

if (!existsSync(source)) {
  console.warn(`[mediapipe] ${relative(root, source)} was not found, so the camera check will be unavailable. Run "npm install".`);
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

const files = readdirSync(target);
console.log(`[mediapipe] copied ${files.length} files to ${relative(root, target)}`);
