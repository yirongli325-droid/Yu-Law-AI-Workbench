import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { scanProject } from "../desktop/credential-scan.mjs";

test("release source, logs, databases, and build outputs contain no credentials", () => {
  assert.deepEqual(scanProject(), []);
});

test("delivery documentation, notices, and SBOM are complete", () => {
  const result = spawnSync(process.execPath, ["desktop/verify-delivery.mjs"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
