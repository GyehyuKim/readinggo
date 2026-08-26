import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const workflowDir = new URL("../.github/workflows/", import.meta.url);
const workflowFiles = readdirSync(workflowDir).filter((file) => /\.ya?ml$/.test(file));
const unpinnedActions = [];
const unpinnedWrangler = [];

for (const file of workflowFiles) {
  const source = readFileSync(new URL(file, workflowDir), "utf8");
  for (const [index, line] of source.split("\n").entries()) {
    const action = line.match(/^\s*- uses:\s+[^\s@]+@([^\s#]+)/);
    if (action && !/^[0-9a-f]{40}$/.test(action[1])) {
      unpinnedActions.push(`${file}:${index + 1} ${action[0].trim()}`);
    }
    if (/\bwrangler@4(?:\s|$)/.test(line)) {
      unpinnedWrangler.push(`${file}:${index + 1}`);
    }
  }
}

assert.deepEqual(unpinnedActions, [], `GitHub Actions must use full commit SHAs:\n${unpinnedActions.join("\n")}`);
assert.deepEqual(unpinnedWrangler, [], `Privileged Wrangler calls must use an exact version:\n${unpinnedWrangler.join("\n")}`);

console.log(`workflow pins: ${workflowFiles.length} files checked`);
