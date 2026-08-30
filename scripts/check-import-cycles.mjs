/**
 * Fails if any import cycle exists under src/.
 *
 * The codebase had 46 of them, 45 caused by barrels: a module importing an
 * index.ts that re-exported the module back, or a feature's barrel pulling in a
 * neighbour that reached back. They were removed by importing concrete modules
 * across feature boundaries; this keeps the count at zero, because the next one
 * is added by accident and is invisible until something initialises in the
 * wrong order.
 *
 * Path aliases and barrel re-exports are resolved the same way Vite and tsc
 * resolve them, so the graph matches what actually loads at runtime.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "src";
const ALIASES = [
  ["@features/", "src/features/"],
  ["@shared/", "src/shared/"]
];
const EXACT = { "@types": "src/types" };

const toPosix = (p) => p.split(path.sep).join("/");

function collectFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|dist/.test(full)) collectFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(toPosix(full));
    }
  }
  return out;
}

const files = collectFiles(ROOT);
const exists = new Set(files);

function resolveSpecifier(spec, fromFile) {
  let base = null;
  if (EXACT[spec]) base = EXACT[spec];
  else {
    for (const [prefix, target] of ALIASES) {
      if (spec.startsWith(prefix)) {
        base = target + spec.slice(prefix.length);
        break;
      }
    }
  }
  if (base === null) {
    if (!spec.startsWith(".")) return null; // a package, not our code
    base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  }
  for (const candidate of [base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx", base]) {
    if (exists.has(candidate)) return candidate;
  }
  return null;
}

const graph = new Map();
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const targets = new Set();
  const pattern = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
  let match;
  while ((match = pattern.exec(source))) {
    const resolved = resolveSpecifier(match[1], file);
    if (resolved && resolved !== file) targets.add(resolved);
  }
  graph.set(file, [...targets]);
}

// Iterative DFS: the graph is small, but recursion depth is not worth risking.
const state = new Map(); // 1 = on the current path, 2 = fully explored
const cycles = [];
const seenCycles = new Set();

for (const start of files) {
  if (state.has(start)) continue;
  const stack = [{ node: start, next: 0 }];
  const onPath = [start];
  state.set(start, 1);

  while (stack.length) {
    const frame = stack[stack.length - 1];
    const edges = graph.get(frame.node) || [];

    if (frame.next < edges.length) {
      const child = edges[frame.next++];
      if (state.get(child) === 1) {
        const from = onPath.indexOf(child);
        if (from >= 0) {
          const loop = onPath.slice(from).concat(child);
          const key = [...new Set(loop)].sort().join("|");
          if (!seenCycles.has(key)) {
            seenCycles.add(key);
            cycles.push(loop);
          }
        }
      } else if (!state.has(child)) {
        state.set(child, 1);
        onPath.push(child);
        stack.push({ node: child, next: 0 });
      }
    } else {
      state.set(frame.node, 2);
      stack.pop();
      onPath.pop();
    }
  }
}

if (cycles.length === 0) {
  console.log(`No import cycles across ${files.length} files.`);
  process.exit(0);
}

console.error(`Found ${cycles.length} import cycle(s):\n`);
for (const loop of cycles) {
  console.error("  " + loop.map((f) => f.replace("src/", "")).join("\n    -> "));
  console.error("");
}
console.error("Import the concrete module rather than reaching through a barrel index.ts.");
console.error("If two modules genuinely need each other, the shared type usually wants its own file.");
process.exit(1);
