import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excluded = new Set([".git", ".autodev", "node_modules"]);
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".pyc"]);
const rules = [
  ["private key", new RegExp(["-----BEGIN (?:RSA |EC |OPENSSH )?", "PRIVATE KEY-----"].join(""))],
  ["provider token", new RegExp(["(?:sk|ghp|xox[baprs])-", "[A-Za-z0-9_-]{20,}"].join(""))],
  ["authorization bearer", new RegExp(["authorization", "\\s*[:=]\\s*", "bearer\\s+[A-Za-z0-9._~-]{12,}"].join(""), "i")],
  ["oauth token", new RegExp(["(?:oauth|access|refresh|id)[_-]?token", "\\s*[:=]\\s*", "['\\\"]?[A-Za-z0-9._~+/-]{8,}"].join(""), "i")],
  ["session cookie", new RegExp(["(?:cookie|set-cookie)", "\\s*[:=]", "[^\\r\\n]{0,120}(?:session|auth|jsessionid|sid)", "\\s*=", "[^;\\s]{8,}"].join(""), "i")],
  ["account password", new RegExp(["(?:password|passwd|pwd)", "\\s*[:=]\\s*", "['\\\"]?[A-Za-z0-9][A-Za-z0-9._~+/-]{7,}"].join(""), "i")],
];

export function scanText(text) { return rules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name); }

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, files);
    else if (entry.isFile() && !binaryExtensions.has(path.extname(entry.name).toLowerCase())) files.push(target);
  }
  return files;
}

export function scanProject(root = projectRoot) {
  const findings = [];
  for (const file of walk(root)) {
    const matches = scanText(fs.readFileSync(file).toString("utf8"));
    if (matches.length) findings.push({ path: path.relative(root, file), matches });
  }
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = scanProject();
  if (findings.length) { console.error(JSON.stringify({ ok: false, findings }, null, 2)); process.exitCode = 1; }
  else console.log(JSON.stringify({ ok: true, scannedProjectTree: true, artifactKindsIncludedWhenPresent: ["source", "logs", "databases", "build outputs"], excludedForbiddenOrDependencyTrees: [".git", ".autodev", "node_modules"] }));
}
