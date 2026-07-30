"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  type Abi,
  type Address,
  type Hash,
} from "viem";
import { getEthereumProvider, isProviderRpcError } from "./ethereum";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
});

/** MetaMask's "chain not added to wallet" error code. */
const CHAIN_NOT_ADDED = 4902;
/** MetaMask's "user rejected the request" error code. */
const USER_REJECTED = 4001;

export interface DeployResult {
  address: Address;
  txHash: Hash;
  gasUsed?: string;
  explorerUrl: string;
}

async function ensureMonadTestnet(): Promise<void> {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error("No wallet detected. Install MetaMask to deploy.");

  const target = `0x${monadTestnet.id.toString(16)}`;
  const current = await ethereum.request<string>({ method: "eth_chainId" });
  if (current === target) return;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: target }],
    });
    return;
  } catch (error) {
    if (!isProviderRpcError(error) || error.code !== CHAIN_NOT_ADDED) throw error;
  }

  await ethereum.request({
    method: "wallet_addEthereumChain",
    params: [{
      chainId: target,
      chainName: monadTestnet.name,
      nativeCurrency: monadTestnet.nativeCurrency,
      rpcUrls: [...monadTestnet.rpcUrls.default.http],
      blockExplorerUrls: [monadTestnet.blockExplorers.default.url],
    }],
  });
}

/**
 * Deploys compiled bytecode from the user's own wallet.
 *
 * The server deliberately does not hold a deployer key. A shared server wallet
 * has to be funded and silently breaks everyone's deploys the moment it runs
 * dry, and it also makes every contract on chain look like it came from one
 * address. Signing here means the user owns what they deploy and pays their own
 * gas, which is the behaviour people expect from a wallet prompt.
 */
export async function deployFromWallet(
  abi: Abi,
  bytecode: string,
  account: Address
): Promise<DeployResult> {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error("No wallet detected. Install MetaMask to deploy.");

  await ensureMonadTestnet();

  const transport = custom(ethereum);
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport });
  const publicClient = createPublicClient({ chain: monadTestnet, transport });

  const balance = await publicClient.getBalance({ address: account });
  if (balance === 0n) {
    throw new Error(
      "This wallet has no testnet MON. Get some from https://faucet.monad.xyz and try again."
    );
  }

  const hex = (bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`) as `0x${string}`;

  let txHash: Hash;
  try {
    txHash = await walletClient.deployContract({ abi, bytecode: hex, args: [] });
  } catch (error) {
    if (isProviderRpcError(error) && error.code === USER_REJECTED) {
      throw new Error("Deployment cancelled in wallet.");
    }
    throw error;
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error("Deployment transaction reverted on chain.");
  }

  return {
    address: receipt.contractAddress,
    txHash,
    gasUsed: receipt.gasUsed?.toString(),
    explorerUrl: `${monadTestnet.blockExplorers.default.url}/address/${receipt.contractAddress}`,
  };
}
