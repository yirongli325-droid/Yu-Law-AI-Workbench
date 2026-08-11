import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = {
  "README.md": ["安装", "登录", "执行", "找回成果", "故障排查", "隐私"],
  "docs/DESKTOP_DELIVERY.md": ["Windows", "已知限制", "可重复构建", "THIRD_PARTY_NOTICES.md", "SBOM.json"],
  "THIRD_PARTY_NOTICES.md": ["第三方", "package-lock.json"],
  "docs/SBOM.json": ["CycloneDX", "components"],
};

for (const [relative, markers] of Object.entries(required)) {
  const target = path.join(root, relative);
  assert.equal(fs.statSync(target).isFile(), true, `${relative} must be a regular file`);
  const body = fs.readFileSync(target, "utf8");
  for (const marker of markers) assert.ok(body.includes(marker), `${relative} must contain ${marker}`);
}

const sbom = JSON.parse(fs.readFileSync(path.join(root, "docs/SBOM.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(sbom.bomFormat, "CycloneDX");
const expected = new Map(Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies }));
assert.equal(sbom.components.length, expected.size, "SBOM must cover every direct dependency");
for (const component of sbom.components) {
  assert.equal(component.version, expected.get(component.name), `SBOM version mismatch for ${component.name}`);
  assert.ok(component.licenses?.length > 0, `SBOM license missing for ${component.name}`);
  expected.delete(component.name);
}
assert.equal(expected.size, 0, `SBOM dependencies missing: ${[...expected.keys()].join(", ")}`);
console.log(JSON.stringify({ ok: true, checked: Object.keys(required) }));
