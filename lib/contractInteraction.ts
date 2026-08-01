"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
  type Abi,
  type AbiFunction,
  type AbiParameter,
  type Address,
  type Hash,
} from "viem";
import { getEthereumProvider, isProviderRpcError } from "./ethereum";
import { monadTestnet } from "./deploy";

/** MetaMask's "user rejected the request" code. */
const USER_REJECTED = 4001;

export type FunctionKind = "read" | "write" | "payable";

export interface ContractFunction {
  name: string;
  kind: FunctionKind;
  inputs: readonly AbiParameter[];
  outputs: readonly AbiParameter[];
  signature: string;
}

export interface CallResult {
  kind: "read";
  outputs: { name: string; type: string; value: string }[];
}

export interface TxResult {
  kind: "write";
  txHash: Hash;
  gasUsed: string;
  explorerUrl: string;
}

/**
 * Splits an ABI into the functions a user can actually invoke.
 *
 * `view` and `pure` are free local calls; everything else costs gas and needs a
 * wallet signature. Payable is separated so the UI knows to offer a value field
 * rather than silently dropping the funds the user meant to send.
 */
export function readableFunctions(abi: Abi): ContractFunction[] {
  return abi
    .filter((entry): entry is AbiFunction => entry.type === "function")
    .map((fn) => {
      const kind: FunctionKind =
        fn.stateMutability === "view" || fn.stateMutability === "pure"
          ? "read"
          : fn.stateMutability === "payable"
            ? "payable"
            : "write";

      return {
        name: fn.name,
        kind,
        inputs: fn.inputs,
        outputs: fn.outputs,
        signature: `${fn.name}(${fn.inputs.map((i) => i.type).join(",")})`,
      };
    })
    .sort((a, b) => {
      // Reads first: they are free and safe to click, so they make the better
      // starting point when exploring an unfamiliar contract.
      if (a.kind === "read" && b.kind !== "read") return -1;
      if (a.kind !== "read" && b.kind === "read") return 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Turns the raw strings from the form into the types viem expects.
 *
 * The form cannot know the difference between the string "123" and the number
 * 123, and passing the wrong one produces an opaque encoding error deep inside
 * viem rather than something the user can act on.
 */
export function coerceArgument(value: string, type: string): unknown {
  const trimmed = value.trim();

  if (type.endsWith("[]")) {
    const inner = type.slice(0, -2);
    const items = trimmed.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
    return items.map((item) => coerceArgument(item, inner));
  }

  if (type === "bool") {
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    throw new Error(`Expected true or false for a bool, got "${value}"`);
  }

  if (/^u?int/.test(type)) {
    if (!/^-?\d+$/.test(trimmed)) {
      throw new Error(`Expected a whole number for ${type}, got "${value}"`);
    }
    return BigInt(trimmed);
  }

  if (type === "address") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      throw new Error(`Expected a 0x address, got "${value}"`);
    }
    return trimmed as Address;
  }

  if (type.startsWith("bytes")) {
    if (!trimmed.startsWith("0x")) {
      throw new Error(`Expected 0x-prefixed hex for ${type}, got "${value}"`);
    }
    return trimmed as `0x${string}`;
  }

  return trimmed;
}

/** Renders a decoded return value without losing precision on big integers. */
function stringifyResult(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(stringifyResult).join(", ")}]`;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));
}

function publicClient() {
  const ethereum = getEthereumProvider();
  // Reads work without a wallet, so fall back to the public RPC rather than
  // forcing a connection just to look at a contract.
  return createPublicClient({
    chain: monadTestnet,
    transport: ethereum ? custom(ethereum) : http(monadTestnet.rpcUrls.default.http[0]),
  });
}

/** Calls a view or pure function. Free, no wallet required. */
export async function callRead(
  address: Address,
  abi: Abi,
  fn: ContractFunction,
  args: string[]
): Promise<CallResult> {
  const typedArgs = fn.inputs.map((input, i) => coerceArgument(args[i] ?? "", input.type));

  const result = await publicClient().readContract({
    address,
    abi,
    functionName: fn.name,
    args: typedArgs,
  });

  // A single unnamed output comes back bare rather than in a tuple.
  const values = fn.outputs.length === 1 ? [result] : (result as unknown[]);

  return {
    kind: "read",
    outputs: fn.outputs.map((output, i) => ({
      name: output.name || `output ${i}`,
      type: output.type,
      value: stringifyResult(values[i]),
    })),
  };
}

/** Sends a state-changing transaction from the user's wallet. */
export async function sendWrite(
  address: Address,
  abi: Abi,
  fn: ContractFunction,
  args: string[],
  account: Address,
  valueWei?: bigint
): Promise<TxResult> {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error("No wallet detected. Install MetaMask to send transactions.");

  const typedArgs = fn.inputs.map((input, i) => coerceArgument(args[i] ?? "", input.type));
  const transport = custom(ethereum);
  const wallet = createWalletClient({ account, chain: monadTestnet, transport });
  const reader = createPublicClient({ chain: monadTestnet, transport });

  // Simulating first turns an on-chain revert into a readable message before
  // the user is asked to sign and pay for a transaction that cannot succeed.
  try {
    await reader.simulateContract({
      address,
      abi,
      functionName: fn.name,
      args: typedArgs,
      account,
      value: valueWei,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw new Error(`This call would revert: ${message}`);
  }

  let txHash: Hash;
  try {
    txHash = await wallet.writeContract({
      address,
      abi,
      functionName: fn.name,
      args: typedArgs,
      value: valueWei,
    });
  } catch (error) {
    if (isProviderRpcError(error) && error.code === USER_REJECTED) {
      throw new Error("Transaction cancelled in wallet.");
    }
    throw error;
  }

  const receipt = await reader.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error("Transaction reverted on chain.");
  }

  return {
    kind: "write",
    txHash,
    gasUsed: receipt.gasUsed.toString(),
    explorerUrl: `${monadTestnet.blockExplorers.default.url}/tx/${txHash}`,
  };
}

/** Native balance of the contract, shown alongside the function list. */
export async function contractBalance(address: Address): Promise<string> {
  const balance = await publicClient().getBalance({ address });
  return formatEther(balance);
}
