// lib/apiTypes.ts
// Response contracts shared by the API routes and the studio UI. Keeping both
// sides on one definition is what stops a renamed field from silently becoming
// `undefined` in the interface.

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface SecurityIssue {
  severity: Severity;
  title: string;
  description: string;
  line?: number;
  recommendation: string;
}

export interface SecurityAnalysis {
  riskLevel: string;
  /** Penalty points accumulated across findings — higher is worse, unbounded. */
  riskScore: number;
  /** 0-100, higher is safer. Derived from riskScore and clamped. */
  securityScore: number;
  deploymentRecommendation: string;
  summary: Record<Severity, number>;
  issues: SecurityIssue[];
  timestamp: string;
  disclaimer: string;
}

export interface SecurityAuditResponse {
  success: boolean;
  analysis?: SecurityAnalysis;
  error?: string;
}

export interface CompilerDiagnostic {
  message: string;
  severity?: string;
  type?: string;
  line?: number;
}

export interface CompileResponse {
  success: boolean;
  abi?: unknown[];
  bytecode?: string;
  contractSize?: number;
  errors?: CompilerDiagnostic[];
  message?: string;
  error?: string;
}

export interface DeployResponse {
  success: boolean;
  address?: string;
  txHash?: string;
  logs?: string;
  gasUsed?: string;
  error?: string;
  paymentDetails?: unknown;
}

export interface AgentTextResponse {
  success: boolean;
  result?: string;
  answer?: string;
  response?: string;
  code?: string;
  report?: string;
  explanation?: string;
  error?: string;
}

export interface PymonFinding {
  severity: Severity;
  title: string;
  description?: string;
}

export interface PymonAuditResponse {
  success: boolean;
  score?: number;
  riskLevel?: string;
  findings?: PymonFinding[];
  bestPractices?: string[];
  error?: string;
}

export interface TranspileResponse {
  success: boolean;
  contractName?: string;
  solidityCode?: string;
  abi?: unknown[];
  error?: string;
}

export interface ExplainErrorResponse {
  success: boolean;
  explanation?: string;
  fix?: string;
  teachMode?: TeachModeContent | null;
  error?: string;
}

export interface TeachModeContent {
  title: string;
  steps: string[];
}

/** Body of a 402 response: the witness the client must sign to proceed. */
export interface PaymentChallenge {
  error?: string;
  paymentDetails: {
    scheme: string;
    networkId: string;
    amount: string;
    witness: {
      domain: { name: string; version: string; chainId: number; verifyingContract: string };
      types: Record<string, { name: string; type: string }[]>;
      primaryType: string;
      message: Record<string, string | number>;
    };
  };
}

/** Narrows an unknown thrown value to a displayable message. */
export function errorMessage(error: unknown, fallback = "Unexpected error"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}
