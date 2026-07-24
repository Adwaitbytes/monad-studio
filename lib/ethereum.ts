// lib/ethereum.ts
// Minimal EIP-1193 provider typings so wallet access is type-safe instead of
// reaching through `window as any` at every call site.

export interface EthereumRequestArgs {
  method: string;
  params?: unknown[];
}

export interface EthereumProvider {
  request<T = unknown>(args: EthereumRequestArgs): Promise<T>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

/** Provider error shape used by MetaMask (e.g. 4902 = chain not added). */
export interface ProviderRpcError extends Error {
  code: number;
}

export function isProviderRpcError(error: unknown): error is ProviderRpcError {
  return error instanceof Error && typeof (error as ProviderRpcError).code === "number";
}

/** Returns the injected wallet provider, or null when no wallet is installed. */
export function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}
