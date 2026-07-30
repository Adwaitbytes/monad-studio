/**
 * Regenerates lib/openzeppelin-bundle.ts from the installed @openzeppelin/contracts.
 *
 * The bundle exists because serverless functions cannot rely on .sol files being
 * traced into the deployment, so solc needs the sources inlined. It used to be
 * maintained by hand, which is how a minified `if (x) unchecked { ... }` got in
 * and broke every ERC721 compile. Generating it from the real package removes
 * that whole class of failure.
 *
 * Run: node scripts/build-oz-bundle.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OZ_ROOT = path.join(ROOT, "node_modules", "@openzeppelin", "contracts");
const OUT = path.join(ROOT, "lib", "openzeppelin-bundle.ts");

// Contracts a generated project is allowed to import. Their dependencies are
// resolved automatically, so this list only names entry points.
const ENTRY_POINTS = [
  "access/Ownable.sol",
  "access/AccessControl.sol",
  "token/ERC20/ERC20.sol",
  "token/ERC20/extensions/ERC20Burnable.sol",
  "token/ERC20/extensions/ERC20Pausable.sol",
  "token/ERC20/extensions/ERC20Permit.sol",
  "token/ERC721/ERC721.sol",
  "token/ERC721/extensions/ERC721Burnable.sol",
  "token/ERC721/extensions/ERC721URIStorage.sol",
  "token/ERC721/extensions/ERC721Enumerable.sol",
  "token/ERC1155/ERC1155.sol",
  "utils/ReentrancyGuard.sol",
  "utils/Pausable.sol",
  "utils/Strings.sol",
  "utils/cryptography/ECDSA.sol",
  "utils/cryptography/MerkleProof.sol",
];

if (!fs.existsSync(OZ_ROOT)) {
  console.error("@openzeppelin/contracts is not installed. Run npm install first.");
  process.exit(1);
}

const version = JSON.parse(
  fs.readFileSync(path.join(OZ_ROOT, "package.json"), "utf8")
).version;

/** Every `import "..."` / `import {X} from "..."` path in a source file. */
function importsOf(source) {
  return [...source.matchAll(/import\s+(?:\{[^}]*\}\s+from\s+)?["']([^"']+)["']/g)].map(
    (m) => m[1]
  );
}

const collected = new Map();

function collect(relPath) {
  const key = `@openzeppelin/contracts/${relPath}`;
  if (collected.has(key)) return;

  const abs = path.join(OZ_ROOT, relPath);
  if (!fs.existsSync(abs)) {
    console.warn(`  skipped (not in this version): ${relPath}`);
    return;
  }

  const source = fs.readFileSync(abs, "utf8");
  collected.set(key, source);

  for (const spec of importsOf(source)) {
    const next = spec.startsWith(".")
      ? path.normalize(path.join(path.dirname(relPath), spec))
      : spec.replace("@openzeppelin/contracts/", "");
    collect(next);
  }
}

for (const entry of ENTRY_POINTS) collect(entry);

const sorted = [...collected.entries()].sort(([a], [b]) => a.localeCompare(b));

const body = sorted
  .map(([key, src]) => {
    // Escape only what breaks a template literal.
    const escaped = src.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
    return `  ${JSON.stringify(key)}: \`${escaped}\`,`;
  })
  .join("\n\n");

const out = `// GENERATED FILE - DO NOT EDIT BY HAND.
// Regenerate with: node scripts/build-oz-bundle.mjs
//
// Verbatim sources from @openzeppelin/contracts@${version}, inlined so solc can
// resolve imports inside a serverless function where node_modules .sol files are
// not guaranteed to be present.

export const OPENZEPPELIN_SOURCES: Record<string, string> = {
${body}
};
`;

fs.writeFileSync(OUT, out);
console.log(`Wrote ${sorted.length} sources from @openzeppelin/contracts@${version} to ${path.relative(ROOT, OUT)}`);
