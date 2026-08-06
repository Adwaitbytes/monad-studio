/**
 * Contention benchmark.
 *
 * Measures whether contract structure changes realised throughput on a parallel
 * EVM. Two contracts do identical work -- one storage read, one add, one write.
 * They differ in a single respect: one writes a shared slot, the other writes a
 * slot keyed by sender. If parallel execution is doing anything, the keyed
 * contract should sustain higher throughput under concurrent load.
 *
 * Holding the workload constant and varying only the slot is what makes this a
 * measurement rather than a demonstration. A cross-chain comparison would mostly
 * measure block time and RPC distance, which says nothing about parallelism.
 *
 * Usage:
 *   BENCH_PRIVATE_KEY=0x... node scripts/benchmark.mjs [--wallets 20] [--rounds 3]
 *
 * The key funds a set of throwaway wallets, which then send concurrently. One
 * account cannot generate concurrent load: its transactions are nonce-ordered
 * and the chain must apply them in sequence regardless of what they touch.
 */

import fs from "node:fs";
import dotenv from "dotenv";

// .env.local rather than .env: that is the file Next.js uses for local secrets
// and the one this project already gitignores.
dotenv.config({ path: ".env.local", quiet: true });
import path from "node:path";
import {
  createPublicClient,
  encodeFunctionData,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  parseEther,
} from "viem";
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from "viem/accounts";

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
});

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};

const WALLETS = flag("wallets", 20);
const ROUNDS = flag("rounds", 3);
// Monad charges the full gas limit rather than gas consumed, and the node
// requires a balance comfortably above that before it will accept the
// transaction at all. 0.02 was rejected outright with "insufficient balance".
const FUNDING = parseEther("0.4");
// Close to the measured 49,839 estimate. Because the limit is what gets
// charged, padding it is not free the way it is on Ethereum.
const GAS_LIMIT = 60_000n;

/**
 * The funding key, from the environment or from a mnemonic in .env.local.
 *
 * Reading it here rather than accepting it on the command line keeps it out of
 * shell history, and .env.local is gitignored so it cannot be committed.
 */
function loadFunder() {
  const direct = process.env.BENCH_PRIVATE_KEY;
  if (direct) {
    return privateKeyToAccount(direct.startsWith("0x") ? direct : `0x${direct}`);
  }

  const phrase = process.env.BENCH_MNEMONIC;
  if (phrase) {
    // Standard Ethereum derivation path, so this matches what a wallet shows
    // as the first account for the same phrase.
    return mnemonicToAccount(phrase.trim());
  }

  console.error("No funding key found.\n");
  console.error("Add ONE of these to .env.local (gitignored, never committed):");
  console.error("  BENCH_PRIVATE_KEY=0x...");
  console.error("  BENCH_MNEMONIC=\"word word word ...\"\n");
  console.error("Then run:  node scripts/benchmark.mjs --wallets 30 --rounds 3");
  console.error("Fund the account first at https://faucet.monad.xyz");
  process.exit(1);
}

const master = loadFunder();
const transport = http(monadTestnet.rpcUrls.default.http[0]);
const publicClient = createPublicClient({ chain: monadTestnet, transport });
const masterWallet = createWalletClient({ account: master, chain: monadTestnet, transport });

const artifact = (name) => {
  const p = path.join(process.cwd(), "artifacts", "contracts", "bench", `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(p)) {
    console.error(`Missing artifact for ${name}. Run: npx hardhat compile`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
};

/**
 * Retries on throttling.
 *
 * The public endpoint returns 429 under concurrent load. Without a backoff the
 * benchmark measures the rate limiter rather than the chain, which is exactly
 * the confound this whole design exists to avoid.
 */
async function withRetry(fn, attempts = 5) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = String(error);
      if (!message.includes("429") && !message.includes("rate limit")) throw error;
      await new Promise((r) => setTimeout(r, 250 * 2 ** i));
    }
  }
  throw lastError;
}

const percentile = (sorted, p) => {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
};

async function deploy(name) {
  const { abi, bytecode } = artifact(name);
  const hash = await masterWallet.deployContract({ abi, bytecode, args: [] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${name} deployment reverted`);
  return { address: receipt.contractAddress, abi };
}

async function fundWallets(count) {
  console.log(`\nFunding ${count} wallets from ${master.address}`);

  const balance = await publicClient.getBalance({ address: master.address });
  const needed = FUNDING * BigInt(count);
  if (balance < needed) {
    console.error(
      `  Need ~${formatEther(needed)} MON, wallet holds ${formatEther(balance)}. ` +
      `Top up at https://faucet.monad.xyz`
    );
    process.exit(1);
  }

  const wallets = [];
  // Funding is sequential on purpose: these all come from one account, so the
  // nonces must be applied in order.
  let nonce = await publicClient.getTransactionCount({ address: master.address });

  for (let i = 0; i < count; i++) {
    const account = privateKeyToAccount(generatePrivateKey());
    const hash = await masterWallet.sendTransaction({
      to: account.address,
      value: FUNDING,
      nonce: nonce++,
    });
    wallets.push({ account, fundingHash: hash });
    process.stdout.write(`\r  sent ${i + 1}/${count}`);
  }

  process.stdout.write("\n  waiting for funding to confirm...");
  await Promise.all(wallets.map((w) => publicClient.waitForTransactionReceipt({ hash: w.fundingHash })));
  console.log(" done");

  return wallets.map((w) => w.account);
}

/**
 * Sends one transaction from every wallet at once and measures how long the
 * whole batch takes to be included. Every wallet sends exactly one transaction,
 * so nothing is serialised by nonce ordering and the only remaining constraint
 * is what the chain does with the storage they touch.
 */
async function runRound(label, contract, wallets, nonces) {
  // Everything that needs the network is done before the clock starts, so the
  // measured window contains only submission and inclusion.
  const data = encodeFunctionData({ abi: contract.abi, functionName: "touch", args: [] });
  const gasPrice = await publicClient.getGasPrice();

  const prepared = [];
  for (const account of wallets) {
    // Nonces are tracked locally. Re-reading them between rounds races the
    // previous round still settling and the node rejects the whole batch.
    const nonce = nonces.get(account.address) ?? 0;
    nonces.set(account.address, nonce + 1);
    const serialized = await account.signTransaction({
      to: contract.address,
      data,
      nonce,
      gas: GAS_LIMIT,
      gasPrice: (gasPrice * 12n) / 10n,
      chainId: monadTestnet.id,
      type: "legacy",
    });
    prepared.push({ account, serialized });
  }

  const started = Date.now();

  const sends = prepared.map(async ({ serialized }) => {
    const sentAt = Date.now();
    try {
      // Pre-signed and sent raw. writeContract would estimate gas and fetch a
      // nonce for every wallet first, tripling the request count and making the
      // public endpoint's rate limit the thing being measured.
      const hash = await withRetry(() => publicClient.sendRawTransaction({ serializedTransaction: serialized }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        ok: receipt.status === "success",
        latency: Date.now() - sentAt,
        gas: Number(receipt.gasUsed),
        block: Number(receipt.blockNumber),
      };
    } catch (error) {
      return { ok: false, latency: Date.now() - sentAt, error: (error?.shortMessage ?? error?.details ?? String(error)).slice(0, 120) };
    }
  });

  const results = await Promise.all(sends);
  const wall = Date.now() - started;

  const ok = results.filter((r) => r.ok);
  const latencies = ok.map((r) => r.latency).sort((a, b) => a - b);
  const blocks = new Set(ok.map((r) => r.block));

  return {
    label,
    wallMs: wall,
    submitted: results.length,
    confirmed: ok.length,
    failed: results.length - ok.length,
    throughput: ok.length / (wall / 1000),
    medianMs: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    // How many blocks the batch landed across. Fewer blocks for the same count
    // means more of them were applied together.
    blocksSpanned: blocks.size,
    txPerBlock: blocks.size ? ok.length / blocks.size : 0,
    avgGas: ok.length ? Math.round(ok.reduce((sum, r) => sum + r.gas, 0) / ok.length) : 0,
    firstError: results.find((r) => !r.ok && r.error)?.error,
  };
}

function report(rows) {
  const pad = (v, n) => String(v).padStart(n);
  console.log("\n" + "=".repeat(78));
  console.log("RESULTS");
  console.log("=".repeat(78));
  console.log(
    "  contract       round  confirm  rate  wall(s)    tx/s   median   p95    blocks  tx/blk"
  );
  for (const r of rows) {
    console.log(
      `  ${r.label.padEnd(15)} ${pad(r.round, 3)}   ${pad(r.confirmed + "/" + r.submitted, 9)}` +
      `   ${pad((r.wallMs / 1000).toFixed(2), 7)}   ${pad(r.throughput.toFixed(2), 5)}` +
      `  ${pad(r.medianMs, 6)}  ${pad(r.p95Ms, 5)}  ${pad(r.blocksSpanned, 6)}  ${pad(r.txPerBlock.toFixed(1), 6)}`
    );
  }

  const summarise = (label) => {
    const rs = rows.filter((r) => r.label === label && r.confirmed > 0);
    if (rs.length === 0) return null;
    return {
      label,
      throughput: rs.reduce((s, r) => s + r.throughput, 0) / rs.length,
      median: rs.reduce((s, r) => s + r.medianMs, 0) / rs.length,
      txPerBlock: rs.reduce((s, r) => s + r.txPerBlock, 0) / rs.length,
      gas: rs.reduce((s, r) => s + r.avgGas, 0) / rs.length,
    };
  };

  const contended = summarise("contended");
  const independent = summarise("independent");

  console.log("\n" + "-".repeat(78));
  if (!contended || !independent) {
    console.log("  Not enough successful rounds to compare.");
    return;
  }

  const ratio = independent.throughput / contended.throughput;
  console.log("  AVERAGES");
  console.log(`    contended     ${contended.throughput.toFixed(2)} tx/s   median ${contended.median.toFixed(0)}ms   ${contended.txPerBlock.toFixed(1)} tx/block   ${contended.gas.toFixed(0)} gas`);
  console.log(`    independent   ${independent.throughput.toFixed(2)} tx/s   median ${independent.median.toFixed(0)}ms   ${independent.txPerBlock.toFixed(1)} tx/block   ${independent.gas.toFixed(0)} gas`);
  console.log(`\n    independent / contended throughput: ${ratio.toFixed(2)}x`);

  console.log("\n  READING THIS");
  if (ratio > 1.15) {
    console.log("    Keyed writes sustained materially higher throughput. Contract");
    console.log("    structure measurably affected realised concurrency.");
  } else if (ratio < 0.87) {
    console.log("    The contended contract was faster, which the model does not predict.");
    console.log("    Suspect testnet noise or a bottleneck outside the chain.");
  } else {
    console.log("    No significant difference at this concurrency. Either the batch was");
    console.log("    too small to saturate the scheduler, or the RPC path dominated. Raise");
    console.log("    --wallets and re-run before drawing any conclusion.");
  }
  console.log("\n  Gas should be near identical across both; a gap means the workloads");
  console.log("  were not equivalent and the comparison is invalid.");
}

async function main() {
  console.log("Contention benchmark - Monad testnet");
  console.log(`  wallets ${WALLETS}   rounds ${ROUNDS}   funder ${master.address}`);

  const balance = await publicClient.getBalance({ address: master.address });
  console.log(`  funder balance ${formatEther(balance)} MON`);

  console.log("\nDeploying benchmark contracts");
  const contended = await deploy("BenchContended");
  console.log(`  contended   ${contended.address}`);
  const independent = await deploy("BenchIndependent");
  console.log(`  independent ${independent.address}`);

  const wallets = await fundWallets(WALLETS);

  // Seeded once from chain, then advanced locally.
  const nonces = new Map();
  for (const account of wallets) {
    nonces.set(account.address, await publicClient.getTransactionCount({ address: account.address }));
  }

  const rows = [];
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\nRound ${round}/${ROUNDS}`);

    // Alternate which contract goes first so a warming RPC connection or a
    // drifting base fee cannot systematically favour one of them.
    const order = round % 2 === 1
      ? [["contended", contended], ["independent", independent]]
      : [["independent", independent], ["contended", contended]];

    for (const [label, contract] of order) {
      process.stdout.write(`  ${label}...`);
      const result = await runRound(label, contract, wallets, nonces);
      rows.push({ ...result, round });
      console.log(
        ` ${result.confirmed}/${result.submitted} in ${(result.wallMs / 1000).toFixed(2)}s` +
        ` (${result.throughput.toFixed(2)} tx/s)` +
        (result.firstError ? `  first error: ${result.firstError}` : "")
      );
    }
  }

  report(rows);

  const out = path.join(process.cwd(), "benchmark-results.json");
  fs.writeFileSync(out, JSON.stringify({
    chain: "monad-testnet",
    chainId: monadTestnet.id,
    wallets: WALLETS,
    rounds: ROUNDS,
    contracts: { contended: contended.address, independent: independent.address },
    rows,
    // Stamped after the run rather than during, so the file records when the
    // measurement finished.
    finishedAt: new Date().toISOString(),
  }, null, 2));
  console.log(`\n  Raw results written to ${path.relative(process.cwd(), out)}`);
}

main().catch((error) => {
  console.error("\nBenchmark failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
