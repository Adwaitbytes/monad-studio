import * as fs from "fs";
import * as path from "path";
import solc from "solc";
import { OPENZEPPELIN_SOURCES } from "./openzeppelin-bundle";

const VIRTUAL_SOURCE = "Migrated.sol";

interface SolcDiagnostic {
  severity: "error" | "warning" | "info";
  formattedMessage: string;
}

export interface CompileCheck {
  compiles: boolean;
  /** First few compiler errors, trimmed for display. */
  errors: string[];
}

/**
 * Compiles a source purely to find out whether it is valid.
 *
 * Migration used to rewrite a contract and hand it back without ever checking
 * the result, so a 0.4 contract whose pragma had been bumped looked migrated
 * and then failed on the first removed keyword. Reporting what still breaks is
 * far more useful than reporting a compatibility score for something that
 * cannot compile at all.
 */
export function checkCompiles(sourceCode: string): CompileCheck {
  const input = {
    language: "Solidity",
    sources: { [VIRTUAL_SOURCE]: { content: sourceCode } },
    settings: { outputSelection: { "*": { "*": ["abi"] } } },
  };

  function findImports(importPath: string): { contents: string } | { error: string } {
    if (OPENZEPPELIN_SOURCES[importPath]) {
      return { contents: OPENZEPPELIN_SOURCES[importPath] };
    }
    if (importPath.startsWith("@openzeppelin/")) {
      try {
        const full = path.join(process.cwd(), "node_modules", importPath);
        if (fs.existsSync(full)) return { contents: fs.readFileSync(full, "utf8") };
      } catch {
        /* fall through to the not-found result */
      }
    }
    return { error: `File not found: ${importPath}` };
  }

  try {
    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
    const diagnostics: SolcDiagnostic[] = output.errors ?? [];
    const errors = diagnostics.filter((d) => d.severity === "error");

    return {
      compiles: errors.length === 0,
      errors: errors.slice(0, 5).map((e) => e.formattedMessage.split("\n").slice(0, 2).join(" ").trim()),
    };
  } catch (error) {
    return {
      compiles: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
