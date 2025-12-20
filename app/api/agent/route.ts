import { NextResponse } from "next/server";
import { verifyPayment, settlePayment } from "../../../lib/q402";
import { createWalletClient, createPublicClient, http, defineChain, getAddress } from "viem";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { privateKeyToAccount } from "viem/accounts";
import { OPENZEPPELIN_SOURCES } from "../../../lib/openzeppelin-bundle";

// --- CHAIN DEFINITIONS ---
const monadTestnet = defineChain({
    id: 10143,
    name: 'Monad Testnet',
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
    rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
});

const monadMainnet = defineChain({
    id: 10143, // Update when mainnet launches
    name: 'Monad Mainnet',
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
    rpcUrls: { default: { http: ['https://mainnet-rpc.monad.xyz'] } },
});

// --- CONFIG ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CHAINGPT_API_KEY = process.env.CHAINGPT_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const CHAINGPT_API_URL = "https://api.chaingpt.org/chat/stream";
const RPC_TESTNET = "https://testnet-rpc.monad.xyz";
const RPC_MAINNET = "https://mainnet-rpc.monad.xyz";

// --- ADDRESS CHECKSUM FIXER ---
function fixAddressChecksums(sourceCode: string): string {
    const addressRegex = /0x[a-fA-F0-9]{40}/g;
    return sourceCode.replace(addressRegex, (match) => {
        try {
            return getAddress(match);
        } catch {
            return match;
        }
    });
}

// --- SOLIDITY COMPILER HELPER ---
const execAsync = promisify(exec);
const solc = require('solc');

// Check if we're running in a serverless/read-only environment
const IS_SERVERLESS = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Serverless compilation with bundled OpenZeppelin
async function compileSolidityServerless(sourceCode: string): Promise<{ abi: any[]; bytecode: string }> {
    try {
        // Extract contract name
        const contractNameMatch = sourceCode.match(/contract\s+(\w+)\s+(?:is\s+)?/);
        const contractName = contractNameMatch ? contractNameMatch[1] : "GenContract";

        console.log(`📦 Serverless compiling contract: ${contractName}`);

        // Prepare input for solc compiler
        const input = {
            language: 'Solidity',
            sources: {
                'GenContract.sol': {
                    content: sourceCode
                }
            },
            settings: {
                outputSelection: {
                    '*': {
                        '*': ['abi', 'evm.bytecode']
                    }
                },
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        };

        // Import callback - uses bundled OpenZeppelin contracts
        function findImports(importPath: string): { contents: string } | { error: string } {
            console.log(`📥 Resolving import: ${importPath}`);

            // Check bundled OpenZeppelin sources first
            if (OPENZEPPELIN_SOURCES[importPath]) {
                console.log(`✅ Found bundled: ${importPath}`);
                return { contents: OPENZEPPELIN_SOURCES[importPath] };
            }

            // Try to read from node_modules as fallback
            if (importPath.startsWith('@openzeppelin/')) {
                try {
                    const ozPath = path.join(process.cwd(), 'node_modules', importPath);
                    if (fs.existsSync(ozPath)) {
                        console.log(`✅ Found in node_modules: ${importPath}`);
                        return { contents: fs.readFileSync(ozPath, 'utf8') };
                    }
                } catch (e) {
                    console.log(`⚠️ Failed to read from node_modules: ${importPath}`);
                }
            }

            console.log(`❌ Import not found: ${importPath}`);
            return { error: `File not found: ${importPath}` };
        }

        // Compile the contract
        const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

        // Check for errors
        if (output.errors) {
            const errors = output.errors.filter((e: any) => e.severity === 'error');
            if (errors.length > 0) {
                const errorMessages = errors.map((e: any) => e.formattedMessage).join('\n');
                console.error('❌ Compilation errors:', errorMessages);
                throw new Error(errorMessages);
            }
            // Log warnings
            const warnings = output.errors.filter((e: any) => e.severity === 'warning');
            if (warnings.length > 0) {
                console.log(`⚠️ ${warnings.length} compilation warnings`);
            }
        }

        // Extract the compiled contract
        const contracts = output.contracts['GenContract.sol'];
        if (!contracts) {
            throw new Error('No contracts found in compilation output');
        }

        // Try to find the contract by name, or use the first one
        let contract = contracts[contractName];
        if (!contract) {
            const availableContracts = Object.keys(contracts);
            console.log(`⚠️ Contract ${contractName} not found, available: ${availableContracts.join(', ')}`);
            contract = contracts[availableContracts[0]];
        }

        if (!contract || !contract.evm || !contract.evm.bytecode) {
            throw new Error(`Contract compilation produced no bytecode`);
        }

        console.log(`✅ Compilation successful! Bytecode size: ${contract.evm.bytecode.object.length / 2} bytes`);

        return {
            abi: contract.abi,
            bytecode: contract.evm.bytecode.object
        };
    } catch (error: any) {
        console.error('❌ Serverless compilation error:', error);
        throw new Error(`Compilation failed: ${error.message}`);
    }
}

async function compileSolidity(sourceCode: string): Promise<{ abi: any[]; bytecode: string }> {
    // Fix any incorrectly checksummed addresses
    const fixedSourceCode = fixAddressChecksums(sourceCode);

    // Use serverless compilation for Vercel/AWS or when filesystem is read-only
    if (IS_SERVERLESS) {
        console.log('🚀 Using serverless compilation (solc-js with bundled OZ)');
        return compileSolidityServerless(fixedSourceCode);
    }

    console.log('🔧 Using local Hardhat compilation');

    const contractNameMatch = fixedSourceCode.match(/contract\s+(\w+)/);
    const contractName = contractNameMatch ? contractNameMatch[1] : "GenContract";

    const contractPath = path.join(process.cwd(), "contracts", "GenContract.sol");

    try {
        fs.writeFileSync(contractPath, fixedSourceCode, "utf-8");
        console.log('✅ Contract file written successfully');
    } catch (writeError: any) {
        console.error('❌ Cannot write to filesystem (read-only):', writeError.message);
        console.log('⚠️ Falling back to serverless compilation');
        return compileSolidityServerless(fixedSourceCode);
    }

    try {
        const { stdout, stderr } = await execAsync("npx hardhat compile --force", {
            cwd: process.cwd(),
            timeout: 60000,
        });

        const artifactPath = path.join(
            process.cwd(),
            "artifacts",
            "contracts",
            "GenContract.sol",
            `${contractName}.json`
        );

        if (!fs.existsSync(artifactPath)) {
            const artifactDir = path.join(process.cwd(), "artifacts", "contracts", "GenContract.sol");
            if (fs.existsSync(artifactDir)) {
                const files = fs.readdirSync(artifactDir).filter(f => f.endsWith(".json") && !f.includes(".dbg."));
                if (files.length > 0) {
                    const artifact = JSON.parse(fs.readFileSync(path.join(artifactDir, files[0]), "utf-8"));
                    return { abi: artifact.abi, bytecode: artifact.bytecode };
                }
            }
            throw new Error(`Compiled artifact not found for contract ${contractName}`);
        }

        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
        return { abi: artifact.abi, bytecode: artifact.bytecode };
    } catch (error: any) {
        const errorMessage = error.stderr || error.message || "Unknown compilation error";
        const errorMatch = errorMessage.match(/Error[^:]*:\s*(.+?)(?:\n|$)/s);
        const cleanError = errorMatch ? errorMatch[1].trim() : errorMessage;
        throw new Error(`Compilation failed: ${cleanError}`);
    }
}

function addressToUUID(address: string) {
    const clean = address.replace("0x", "").toLowerCase().padEnd(32, "0");
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`;
}

// --- OPENAI API HELPER (Primary - Most Powerful) ---
async function callOpenAIAPI(prompt: string, systemRole: string = "You are a helpful AI assistant."): Promise<string> {
    if (!OPENAI_API_KEY) throw new Error("OpenAI API key not configured");

    console.log("🤖 Calling OpenAI API (GPT-4)...");

    const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemRole },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 4096
        })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("❌ OpenAI API error:", err);
        throw new Error(`OpenAI API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

// --- GROQ API HELPER (Fast Fallback) ---
async function callGroqAPI(prompt: string, systemRole: string = "You are a helpful AI assistant."): Promise<string> {
    if (!GROQ_API_KEY) throw new Error("Groq API key not configured");

    console.log("🤖 Calling Groq API...");

    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemRole },
                { role: "user", content: prompt }
            ],
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

// --- CHAINGPT API HELPER (Web3 Specialized Fallback) ---
async function callChainGPTAPI(model: string, question: string, userAddress?: string): Promise<string> {
    if (!CHAINGPT_API_KEY) throw new Error("ChainGPT API key not configured");

    const response = await fetch(CHAINGPT_API_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${CHAINGPT_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            question,
            chatHistory: "on",
            sdkUniqueId: userAddress ? addressToUUID(userAddress) : undefined
        })
    });
    const raw = await response.text();
    try { return JSON.parse(raw).data?.bot || raw; } catch { return raw; }
}

// --- UNIFIED AI CALL (OpenAI Primary -> Groq -> ChainGPT) ---
async function callAI(prompt: string, systemRole: string, userAddress?: string): Promise<string> {
    // Try OpenAI first (most powerful)
    if (OPENAI_API_KEY) {
        try {
            return await callOpenAIAPI(prompt, systemRole);
        } catch (error: any) {
            console.log(`⚠️ OpenAI failed: ${error.message}, trying fallback...`);
        }
    }

    // Try Groq second (fast)
    if (GROQ_API_KEY) {
        try {
            return await callGroqAPI(prompt, systemRole);
        } catch (error: any) {
            console.log(`⚠️ Groq failed: ${error.message}, trying ChainGPT...`);
        }
    }

    // Try ChainGPT last
    if (CHAINGPT_API_KEY) {
        try {
            return await callChainGPTAPI("general_assistant", prompt, userAddress);
        } catch (error: any) {
            console.error("❌ ChainGPT also failed:", error);
        }
    }

    throw new Error("All AI services unavailable");
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, prompt, code, userAddress, network, toAddress, amount } = body;

        console.log(`🔹 API Request: [${action}] from [${userAddress?.slice(0, 10)}...]`);

        // Check API keys
        if (!OPENAI_API_KEY && !GROQ_API_KEY && !CHAINGPT_API_KEY) {
            return NextResponse.json({
                error: "Server Error: No AI API key configured. Set OPENAI_API_KEY, GROQ_API_KEY, or CHAINGPT_API_KEY."
            }, { status: 500 });
        }

        if (!userAddress) {
            return NextResponse.json({ error: "Policy Violation: No authenticated wallet." }, { status: 403 });
        }

        // Deny list check
        const incomingUser = userAddress.toLowerCase();
        const DENY_LIST = ["0xdead00000000000000000000000000000000beef"];
        if (DENY_LIST.includes(incomingUser)) {
            return NextResponse.json({ error: "❌ Policy Violation: Wallet Address is Denylisted." }, { status: 403 });
        }

        // Q402 Payment gate for premium actions
        const PAID_ACTIONS = ["audit", "deploy"];
        if (PAID_ACTIONS.includes(action)) {
            const paymentHeader = req.headers.get("x-payment");
            if (!paymentHeader) {
                const witnessData = {
                    domain: {
                        name: "q402", version: "1",
                        chainId: network === "mainnet" ? 10143 : 10143,
                        verifyingContract: "0x0000000000000000000000000000000000000000"
                    },
                    types: {
                        Witness: [
                            { name: "owner", type: "address" },
                            { name: "token", type: "address" },
                            { name: "amount", type: "uint256" },
                            { name: "to", type: "address" },
                            { name: "deadline", type: "uint256" },
                            { name: "paymentId", type: "bytes32" },
                            { name: "nonce", type: "uint256" }
                        ]
                    },
                    primaryType: "Witness",
                    message: {
                        owner: userAddress,
                        token: "0x0000000000000000000000000000000000000000",
                        amount: "100000000000000",
                        to: "0x9dF95D6b0Fa0F09C6a90B60D1B7F79167195EDB1",
                        deadline: Math.floor(Date.now() / 1000) + 3600,
                        paymentId: "0x" + Math.random().toString(16).slice(2).padEnd(64, '0'),
                        nonce: Date.now().toString()
                    }
                };
                return NextResponse.json({
                    error: "Payment Required",
                    paymentDetails: {
                        scheme: "evm/eip7702-delegated-payment",
                        networkId: network === "mainnet" ? "monad-mainnet" : "monad-testnet",
                        amount: witnessData.message.amount,
                        witness: witnessData
                    }
                }, { status: 402 });
            }

            try {
                const buffer = Buffer.from(paymentHeader, 'base64');
                const payload = JSON.parse(buffer.toString('utf-8'));
                const isValid = await verifyPayment(payload);
                if (!isValid) throw new Error("Invalid Signature");
                await settlePayment(payload);
                console.log("✅ Q402: Payment Verified & Settled.");
            } catch (e) {
                console.error("❌ Payment Verification Failed:", e);
                return NextResponse.json({ error: "Invalid Payment Signature" }, { status: 403 });
            }
        }

        // =========================================================
        // ACTION HANDLERS
        // =========================================================

        if (action === "research") {
            console.log(`🔍 Research query: ${prompt?.slice(0, 50)}...`);
            const result = await callAI(
                prompt,
                "You are a helpful Web3 and blockchain expert. Answer questions clearly and concisely.",
                userAddress
            );
            return NextResponse.json({ success: true, result, answer: result, response: result });
        }

        if (action === "generate") {
            console.log(`🧠 Generating code for: ${prompt?.slice(0, 50)}...`);

            const codePrompt = `You are a Senior Solidity Architect. Write a production-grade, error-free smart contract.

STRICT REQUIREMENTS:
1. **Contract Name**: MUST be 'GenContract' (e.g. 'contract GenContract is ...'). This is required for our deployment scripts.
2. **Pragma**: Use '^0.8.20'.
3. **Logic**: Implement EXACTLY what the user asks.
4. **No Constructor Args**: Hardcode all initial values. Constructor should take NO parameters.
5. **Receive Function**: Include 'receive() external payable {}'.
6. **SPDX**: Start with '// SPDX-License-Identifier: MIT'.
7. **Output**: ONLY valid Solidity code. NO markdown, NO explanations, NO code blocks.
8. **OpenZeppelin**: You can use these imports:
   - @openzeppelin/contracts/token/ERC20/ERC20.sol
   - @openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol
   - @openzeppelin/contracts/token/ERC721/ERC721.sol
   - @openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol
   - @openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol
   - @openzeppelin/contracts/access/Ownable.sol
   - @openzeppelin/contracts/utils/ReentrancyGuard.sol

USER REQUEST: "${prompt}"

Generate the contract now:`;

            let generatedCode = await callAI(
                codePrompt,
                "You are a Solidity expert. Generate ONLY pure Solidity code. No markdown, no explanations, no code blocks.",
                userAddress
            );

            // Clean up
            generatedCode = generatedCode.replace(/```solidity/g, "").replace(/```/g, "").trim();
            if (generatedCode.startsWith("SPDX-License-Identifier")) {
                generatedCode = "// " + generatedCode;
            }
            generatedCode = generatedCode.replace(/MITpragma/, "MIT\npragma");

            return NextResponse.json({ success: true, code: generatedCode });
        }

        if (action === "architect") {
            console.log(`🏗️ Architect generating contract: ${body.contractType}`);

            const architectSystemRole = `You are a senior blockchain architect specializing in Solidity smart contract development for the Monad Network.

Your contracts are:
- Production-ready and thoroughly tested patterns
- Gas-optimized for Monad's parallel EVM
- Following all security best practices (ReentrancyGuard, access control, input validation)
- Compliant with OpenZeppelin standards
- Fully documented with NatSpec comments

CRITICAL REQUIREMENTS:
1. Use Solidity ^0.8.24
2. All contracts MUST compile without errors
3. Include comprehensive events for all state changes
4. Use OpenZeppelin imports where applicable:
   - @openzeppelin/contracts/token/ERC20/ERC20.sol
   - @openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol
   - @openzeppelin/contracts/token/ERC721/ERC721.sol
   - @openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol
   - @openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol
   - @openzeppelin/contracts/access/Ownable.sol
   - @openzeppelin/contracts/access/AccessControl.sol
   - @openzeppelin/contracts/utils/ReentrancyGuard.sol
   - @openzeppelin/contracts/utils/Pausable.sol

OUTPUT FORMAT: Return ONLY valid Solidity code starting with "// SPDX-License-Identifier: MIT".
NO markdown code blocks, NO explanations, NO additional text.`;

            let generatedCode = await callAI(
                prompt,
                architectSystemRole,
                userAddress
            );

            // Clean up the generated code
            generatedCode = generatedCode.replace(/```solidity/g, "").replace(/```/g, "").trim();
            if (generatedCode.startsWith("SPDX-License-Identifier")) {
                generatedCode = "// " + generatedCode;
            }
            generatedCode = generatedCode.replace(/MITpragma/, "MIT\npragma");

            // Ensure it starts correctly
            if (!generatedCode.startsWith("// SPDX")) {
                const spdxIndex = generatedCode.indexOf("// SPDX");
                if (spdxIndex > 0) {
                    generatedCode = generatedCode.substring(spdxIndex);
                }
            }

            console.log(`✅ Architect generated ${generatedCode.length} characters of code`);

            return NextResponse.json({
                success: true,
                code: generatedCode,
                contractType: body.contractType,
                params: body.params
            });
        }

        if (action === "audit") {
            console.log("🛡️ Auditing contract...");

            const auditPrompt = `You are a smart contract security auditor. Analyze this Solidity code:

CODE TO AUDIT:
${code}

Provide a structured audit report with:
1. Critical Issues (if any)
2. Medium Issues (if any)
3. Low Issues (if any)
4. Gas Optimizations
5. Overall Assessment`;

            const report = await callAI(
                auditPrompt,
                "You are a smart contract security auditor. Analyze code for vulnerabilities and best practices.",
                userAddress
            );

            return NextResponse.json({ success: true, report });
        }

        if (action === "compile") {
            console.log("🔨 Compiling contract...");

            try {
                const { abi, bytecode } = await compileSolidity(code);

                return NextResponse.json({
                    success: true,
                    abi,
                    bytecode: bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`,
                    contractSize: bytecode.length / 2
                });
            } catch (error: any) {
                console.error("❌ Compilation failed:", error.message);
                return NextResponse.json({
                    success: false,
                    errors: [{ message: error.message, severity: "error", type: "CompilerError" }],
                    message: error.message
                });
            }
        }

        if (action === "explain_error") {
            console.log("🤖 Explaining error...");

            const { errors } = body;
            const errorMessages = errors?.map((e: any) => e.message).join("\n") || "Unknown error";

            const explainPrompt = `You are a Solidity teacher. A developer has these compilation errors:

ERRORS:
${errorMessages}

CODE:
${code}

Provide:
1. A clear explanation of what went wrong
2. The exact fix with code
3. A brief lesson on avoiding this error

Format as JSON:
{
  "explanation": "...",
  "fix": "...",
  "teachMode": { "title": "...", "steps": ["step1", "step2", "step3"] }
}`;

            const result = await callAI(
                explainPrompt,
                "You are a friendly Solidity teacher. Always respond with valid JSON.",
                userAddress
            );

            try {
                const parsed = JSON.parse(result);
                return NextResponse.json({ success: true, ...parsed });
            } catch {
                return NextResponse.json({ success: true, explanation: result, teachMode: null });
            }
        }

        if (action === "deploy") {
            const isMainnet = network === "mainnet";
            const targetRpc = isMainnet ? RPC_MAINNET : RPC_TESTNET;
            const chain = isMainnet ? monadMainnet : monadTestnet;

            console.log(`🚀 Deploying to ${chain.name}...`);

            const privateKey = process.env.PRIVATE_KEY;
            if (!privateKey) {
                return NextResponse.json({ error: "Server Error: Missing PRIVATE_KEY" }, { status: 500 });
            }

            try {
                // Compile
                console.log("📦 Compiling contract...");
                const { abi, bytecode } = await compileSolidity(code);

                if (!bytecode || bytecode.length < 10) {
                    throw new Error("Compilation produced invalid bytecode");
                }

                // Create clients
                const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey as `0x${string}` : `0x${privateKey}`);

                const publicClient = createPublicClient({
                    chain,
                    transport: http(targetRpc),
                });

                const walletClient = createWalletClient({
                    account,
                    chain,
                    transport: http(targetRpc),
                });

                // Deploy
                console.log("🚀 Sending deployment transaction...");
                const formattedBytecode = bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`;

                const hash = await walletClient.deployContract({
                    abi,
                    bytecode: formattedBytecode as `0x${string}`,
                    args: [],
                });

                console.log(`📝 TX Hash: ${hash}`);

                // Wait for receipt
                const receipt = await publicClient.waitForTransactionReceipt({ hash });
                const address = receipt.contractAddress;

                console.log(`✅ Deployed to: ${address}`);

                return NextResponse.json({
                    success: true,
                    address,
                    txHash: hash,
                    logs: `Contract deployed to: ${address}\nTransaction: ${hash}`,
                    gasUsed: receipt.gasUsed?.toString()
                });
            } catch (error: any) {
                console.error("❌ Deployment failed:", error);
                return NextResponse.json({
                    success: false,
                    error: error.message || "Deployment Failed"
                }, { status: 500 });
            }
        }

        if (action === "transfer") {
            console.log(`💸 Transfer: ${amount} to ${toAddress}`);
            const isMainnet = network === "mainnet";
            const targetRpc = isMainnet ? RPC_MAINNET : RPC_TESTNET;
            const chain = isMainnet ? monadMainnet : monadTestnet;

            const privateKey = process.env.PRIVATE_KEY;
            if (!privateKey) {
                return NextResponse.json({ error: "Server Error: Missing PRIVATE_KEY" }, { status: 500 });
            }

            try {
                const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey as `0x${string}` : `0x${privateKey}`);

                const publicClient = createPublicClient({ chain, transport: http(targetRpc) });
                const walletClient = createWalletClient({ account, chain, transport: http(targetRpc) });

                const hash = await walletClient.sendTransaction({
                    to: toAddress as `0x${string}`,
                    value: BigInt(Math.floor(parseFloat(amount) * 10 ** 18)),
                });

                await publicClient.waitForTransactionReceipt({ hash });
                return NextResponse.json({ success: true, txHash: hash });
            } catch (error: any) {
                return NextResponse.json({ error: error.message || "Transfer Failed" }, { status: 500 });
            }
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("❌ API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
