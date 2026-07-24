// app/api/pymon/route.ts
// PyMon API Route - Python to EVM Transpiler Integration for MonadStudio

import { NextResponse } from "next/server";

// Monad Network Configuration
const MONAD_CONFIG = {
    testnet: {
        rpc: "https://testnet-rpc.monad.xyz",
        chainId: 10143,
        explorer: "https://testnet.monadexplorer.com",
        currency: "MON"
    },
    mainnet: {
        rpc: "https://mainnet-rpc.monad.xyz",
        chainId: 10143, // Update when mainnet launches
        explorer: "https://monadexplorer.com",
        currency: "MON"
    }
};

// Python Contract Templates
const PYTHON_TEMPLATES = {
    SimpleStorage: `from pymon_service.py_contracts import PySmartContract, public_function, view_function

class SimpleStorage(PySmartContract):
    """
    Simple Storage Contract for Monad
    Stores and retrieves a single value
    """

    def __init__(self):
        super().__init__()
        self.stored_value = self.state_var("stored_value", 0, "uint256")
        self.owner = self.state_var("owner", self.msg_sender(), "address")

    @public_function
    def store(self, value: int):
        """Store a new value"""
        self.set_state("stored_value", value)
        self.event("ValueStored", value=value, sender=self.msg_sender())

    @view_function
    def retrieve(self) -> int:
        """Retrieve the stored value"""
        return self.get_state("stored_value")

    @view_function
    def get_owner(self) -> str:
        """Get the contract owner"""
        return self.get_state("owner")
`,

    Counter: `from pymon_service.py_contracts import PySmartContract, public_function, view_function

class Counter(PySmartContract):
    """
    Counter Contract for Monad
    Increment, decrement, and reset a counter
    """

    def __init__(self):
        super().__init__()
        self.count = self.state_var("count", 0, "uint256")
        self.owner = self.state_var("owner", self.msg_sender(), "address")

    @public_function
    def increment(self):
        """Increment counter by 1"""
        current = self.get_state("count")
        self.set_state("count", current + 1)
        self.event("CountChanged", new_value=current + 1, action="increment")

    @public_function
    def decrement(self):
        """Decrement counter by 1"""
        current = self.get_state("count")
        self.require(current > 0, "Counter cannot go below zero")
        self.set_state("count", current - 1)
        self.event("CountChanged", new_value=current - 1, action="decrement")

    @public_function
    def reset(self):
        """Reset counter to zero (owner only)"""
        self.require(self.msg_sender() == self.get_state("owner"), "Only owner can reset")
        self.set_state("count", 0)
        self.event("CountReset", by=self.msg_sender())

    @view_function
    def get_count(self) -> int:
        """Get current count"""
        return self.get_state("count")
`,

    BasicToken: `from pymon_service.py_contracts import PySmartContract, public_function, view_function

class BasicToken(PySmartContract):
    """
    Basic ERC20-like Token for Monad
    Simple token with transfer and mint functionality
    """

    def __init__(self):
        super().__init__()
        self.name = self.state_var("name", "My Monad Token", "string")
        self.symbol = self.state_var("symbol", "MMT", "string")
        self.decimals = self.state_var("decimals", 18, "uint8")
        self.total_supply = self.state_var("total_supply", 0, "uint256")
        self.balances = self.mapping("balances", "address", "uint256")
        self.owner = self.state_var("owner", self.msg_sender(), "address")

    @public_function
    def initialize(self, initial_supply: int):
        """Initialize token with initial supply"""
        self.require(self.get_state("total_supply") == 0, "Already initialized")
        supply = initial_supply * (10 ** 18)
        self.set_state("total_supply", supply)
        balances = self.get_state("balances")
        balances[self.msg_sender()] = supply
        self.event("Transfer", from_addr="0x0", to=self.msg_sender(), amount=supply)

    @view_function
    def balance_of(self, account: str) -> int:
        """Get token balance of an account"""
        balances = self.get_state("balances")
        return balances.get(account, 0)

    @public_function
    def transfer(self, to: str, amount: int) -> bool:
        """Transfer tokens to another address"""
        balances = self.get_state("balances")
        sender = self.msg_sender()

        self.require(balances.get(sender, 0) >= amount, "Insufficient balance")
        self.require(to != "0x0000000000000000000000000000000000000000", "Invalid recipient")

        balances[sender] = balances.get(sender, 0) - amount
        balances[to] = balances.get(to, 0) + amount

        self.event("Transfer", from_addr=sender, to=to, amount=amount)
        return True

    @public_function
    def mint(self, to: str, amount: int):
        """Mint new tokens (owner only)"""
        self.require(self.msg_sender() == self.get_state("owner"), "Only owner can mint")

        balances = self.get_state("balances")
        balances[to] = balances.get(to, 0) + amount
        self.set_state("total_supply", self.get_state("total_supply") + amount)

        self.event("Transfer", from_addr="0x0", to=to, amount=amount)

    @view_function
    def get_total_supply(self) -> int:
        """Get total token supply"""
        return self.get_state("total_supply")
`,

    NFTCollection: `from pymon_service.py_contracts import PySmartContract, public_function, view_function, payable_function

class NFTCollection(PySmartContract):
    """
    Simple NFT Collection for Monad
    Mint and transfer NFTs
    """

    def __init__(self):
        super().__init__()
        self.name = self.state_var("name", "Monad NFT", "string")
        self.symbol = self.state_var("symbol", "MNFT", "string")
        self.total_supply = self.state_var("total_supply", 0, "uint256")
        self.max_supply = self.state_var("max_supply", 10000, "uint256")
        self.mint_price = self.state_var("mint_price", 10000000000000000, "uint256")  # 0.01 MON
        self.owners = self.mapping("owners", "uint256", "address")
        self.balances = self.mapping("balances", "address", "uint256")
        self.token_uris = self.mapping("token_uris", "uint256", "string")
        self.owner = self.state_var("owner", self.msg_sender(), "address")

    @payable_function
    def mint(self, uri: str):
        """Mint a new NFT"""
        self.require(self.msg_value() >= self.get_state("mint_price"), "Insufficient payment")
        self.require(self.get_state("total_supply") < self.get_state("max_supply"), "Max supply reached")

        token_id = self.get_state("total_supply")
        self.set_state("total_supply", token_id + 1)

        owners = self.get_state("owners")
        owners[token_id] = self.msg_sender()

        balances = self.get_state("balances")
        balances[self.msg_sender()] = balances.get(self.msg_sender(), 0) + 1

        token_uris = self.get_state("token_uris")
        token_uris[token_id] = uri

        self.event("Transfer", from_addr="0x0", to=self.msg_sender(), token_id=token_id)

    @public_function
    def transfer(self, to: str, token_id: int):
        """Transfer NFT to another address"""
        owners = self.get_state("owners")
        self.require(owners.get(token_id) == self.msg_sender(), "Not token owner")

        balances = self.get_state("balances")
        balances[self.msg_sender()] -= 1
        balances[to] = balances.get(to, 0) + 1
        owners[token_id] = to

        self.event("Transfer", from_addr=self.msg_sender(), to=to, token_id=token_id)

    @view_function
    def owner_of(self, token_id: int) -> str:
        """Get owner of a token"""
        owners = self.get_state("owners")
        return owners.get(token_id, "0x0000000000000000000000000000000000000000")

    @view_function
    def token_uri(self, token_id: int) -> str:
        """Get token URI"""
        token_uris = self.get_state("token_uris")
        return token_uris.get(token_id, "")

    @public_function
    def withdraw(self):
        """Withdraw contract balance (owner only)"""
        self.require(self.msg_sender() == self.get_state("owner"), "Only owner")
        self.transfer(self.msg_sender(), self.balance())
`
};

// ============= INLINE PYTHON TRANSPILER =============
// This is a TypeScript implementation of the Python transpiler for direct use

interface AbiInput {
    name: string;
    type: string;
}

interface AbiEntry {
    type: string;
    name?: string;
    inputs?: AbiInput[];
    outputs?: AbiInput[];
    stateMutability?: string;
}

interface StateVariable {
    name: string;
    type: string;
    initialValue: string | number | boolean | null;
    slot: number;
    isMapping: boolean;
    keyType?: string;
    valueType?: string;
}

interface FunctionDef {
    name: string;
    params: Array<{ name: string; type: string }>;
    returnType: string;
    isPublic: boolean;
    isView: boolean;
    isPayable: boolean;
    body: string;
    selector: string;
}

interface ContractAnalysis {
    name: string;
    stateVars: StateVariable[];
    functions: FunctionDef[];
    constructorBody: string;
}

// Simple Python parser for contract structure
function parsePythonContract(code: string): ContractAnalysis | null {
    let contractName = '';
    const stateVars: StateVariable[] = [];
    const functions: FunctionDef[] = [];
    let slotCounter = 0;

    // Find class definition
    const classMatch = code.match(/class\s+(\w+)\s*\(\s*PySmartContract\s*\)/);
    if (!classMatch) {
        return null;
    }
    contractName = classMatch[1];

    // Find state variables in __init__
    const initMatch = code.match(/def\s+__init__\s*\(self\):([\s\S]*?)(?=\n\s*(?:@|def\s+\w+|$))/);
    if (initMatch) {
        const initBody = initMatch[1];

        // Find state_var calls
        const stateVarRegex = /self\.(\w+)\s*=\s*self\.state_var\s*\(\s*["'](\w+)["']\s*,\s*([^,]+)\s*,\s*["'](\w+)["']\s*\)/g;
        let match;
        while ((match = stateVarRegex.exec(initBody)) !== null) {
            stateVars.push({
                name: match[2],
                type: match[4],
                initialValue: match[3].trim(),
                slot: slotCounter++,
                isMapping: false
            });
        }

        // Find mapping calls
        const mappingRegex = /self\.(\w+)\s*=\s*self\.mapping\s*\(\s*["'](\w+)["']\s*,\s*["'](\w+)["']\s*,\s*["'](\w+)["']\s*\)/g;
        while ((match = mappingRegex.exec(initBody)) !== null) {
            stateVars.push({
                name: match[2],
                type: `mapping(${match[3]} => ${match[4]})`,
                initialValue: null,
                slot: slotCounter++,
                isMapping: true,
                keyType: match[3],
                valueType: match[4]
            });
        }
    }

    // Find functions with decorators
    const funcRegex = /@(public_function|view_function|payable_function)\s*\n\s*def\s+(\w+)\s*\(self(?:,\s*([^)]*))?\)(?:\s*->\s*(\w+))?:/g;
    let funcMatch;
    while ((funcMatch = funcRegex.exec(code)) !== null) {
        const decorator = funcMatch[1];
        const funcName = funcMatch[2];
        const paramsStr = funcMatch[3] || '';
        const returnType = funcMatch[4] || '';

        const params: Array<{ name: string; type: string }> = [];
        if (paramsStr.trim()) {
            const paramParts = paramsStr.split(',');
            for (const part of paramParts) {
                const paramMatch = part.trim().match(/(\w+)(?:\s*:\s*(\w+))?/);
                if (paramMatch) {
                    params.push({
                        name: paramMatch[1],
                        type: paramMatch[2] || 'uint256'
                    });
                }
            }
        }

        // Compute function selector
        const paramTypes = params.map(p => pythonToSolidityType(p.type)).join(',');
        const signature = `${funcName}(${paramTypes})`;
        const selector = computeSelector(signature);

        functions.push({
            name: funcName,
            params,
            returnType: pythonToSolidityType(returnType),
            isPublic: true,
            isView: decorator === 'view_function',
            isPayable: decorator === 'payable_function',
            body: '',
            selector
        });
    }

    return {
        name: contractName,
        stateVars,
        functions,
        constructorBody: ''
    };
}

function pythonToSolidityType(pyType: string): string {
    const mapping: Record<string, string> = {
        'int': 'uint256',
        'str': 'string',
        'bool': 'bool',
        'bytes': 'bytes',
        'address': 'address',
        'uint256': 'uint256',
        'uint8': 'uint8',
        '': ''
    };
    return mapping[pyType] || pyType || 'uint256';
}

function computeSelector(signature: string): string {
    // Simple hash for demo - in production use proper keccak256
    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
        const char = signature.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return '0x' + Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

function generateSolidity(analysis: ContractAnalysis): string {
    const lines: string[] = [];

    lines.push('// SPDX-License-Identifier: MIT');
    lines.push('// Generated by PyMon Transpiler for MonadStudio');
    lines.push('pragma solidity ^0.8.20;');
    lines.push('');
    lines.push(`contract ${analysis.name} {`);

    // State variables
    for (const v of analysis.stateVars) {
        if (v.isMapping) {
            lines.push(`    ${v.type} public ${v.name};`);
        } else {
            const initial = formatInitialValue(v.initialValue, v.type);
            if (initial && initial !== '0' && initial !== '""') {
                lines.push(`    ${v.type} public ${v.name} = ${initial};`);
            } else {
                lines.push(`    ${v.type} public ${v.name};`);
            }
        }
    }
    lines.push('');

    // Constructor
    lines.push('    constructor() {');
    lines.push('        // Initialize state');
    lines.push('    }');
    lines.push('');

    // Functions
    for (const func of analysis.functions) {
        const visibility = 'public';
        const modifiers: string[] = [];
        if (func.isView) modifiers.push('view');
        if (func.isPayable) modifiers.push('payable');

        const params = func.params.map(p => `${pythonToSolidityType(p.type)} ${p.name}`).join(', ');
        const returns = func.returnType ? ` returns (${func.returnType})` : '';
        const mods = modifiers.length > 0 ? ' ' + modifiers.join(' ') : '';

        lines.push(`    function ${func.name}(${params}) ${visibility}${mods}${returns} {`);
        lines.push('        // Function body');
        lines.push('    }');
        lines.push('');
    }

    // Receive function
    if (analysis.functions.some(f => f.isPayable)) {
        lines.push('    receive() external payable {}');
    }

    lines.push('}');

    return lines.join('\n');
}

function formatInitialValue(value: string | number | boolean | null | undefined, type: string): string {
    if (value === null || value === undefined) return '0';

    const valueStr = String(value).trim();

    if (valueStr.includes('self.msg_sender()')) {
        return 'msg.sender';
    }
    if (type === 'string') {
        if (valueStr.startsWith('"') || valueStr.startsWith("'")) {
            return valueStr.replace(/'/g, '"');
        }
        return `"${valueStr}"`;
    }
    if (type === 'bool') {
        return valueStr.toLowerCase() === 'true' ? 'true' : 'false';
    }
    return valueStr;
}

function generateABI(analysis: ContractAnalysis): AbiEntry[] {
    const abi: AbiEntry[] = [];

    // Constructor
    abi.push({
        type: 'constructor',
        inputs: [],
        stateMutability: 'nonpayable'
    });

    // Functions
    for (const func of analysis.functions) {
        abi.push({
            type: 'function',
            name: func.name,
            inputs: func.params.map(p => ({
                name: p.name,
                type: pythonToSolidityType(p.type)
            })),
            outputs: func.returnType ? [{ name: '', type: func.returnType }] : [],
            stateMutability: func.isPayable ? 'payable' : (func.isView ? 'view' : 'nonpayable')
        });
    }

    // State variable getters
    for (const v of analysis.stateVars) {
        if (!v.isMapping) {
            abi.push({
                type: 'function',
                name: v.name,
                inputs: [],
                outputs: [{ name: '', type: v.type }],
                stateMutability: 'view'
            });
        }
    }

    // Receive
    if (analysis.functions.some(f => f.isPayable)) {
        abi.push({
            type: 'receive',
            stateMutability: 'payable'
        });
    }

    return abi;
}

// ============= SECURITY AUDITOR =============

interface AuditFinding {
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    line?: number;
    recommendation: string;
}

function auditPythonContract(code: string): {
    score: number;
    riskLevel: string;
    findings: AuditFinding[];
    summary: string;
} {
    const findings: AuditFinding[] = [];
    const lines = code.split('\n');

    // Check for access control
    let hasAccessControl = false;
    let hasStateModification = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Check for require with owner check
        if (line.includes('self.require') && (line.includes('owner') || line.includes('msg_sender'))) {
            hasAccessControl = true;
        }

        // Check for state modification
        if (line.includes('set_state')) {
            hasStateModification = true;
        }

        // Check for hardcoded addresses
        const addressMatch = line.match(/0x[a-fA-F0-9]{40}/);
        if (addressMatch && addressMatch[0] !== '0x0000000000000000000000000000000000000000') {
            findings.push({
                type: 'hardcoded_address',
                severity: 'medium',
                title: 'Hardcoded Address',
                description: `Hardcoded address found: ${addressMatch[0]}`,
                line: lineNum,
                recommendation: 'Use configurable addresses or constructor parameters'
            });
        }

        // Check for timestamp dependence
        if (line.includes('block_timestamp')) {
            findings.push({
                type: 'timestamp_dependence',
                severity: 'medium',
                title: 'Timestamp Dependence',
                description: 'Contract relies on block timestamp',
                line: lineNum,
                recommendation: 'Avoid using timestamps for critical logic'
            });
        }

        // Check for unbounded loops
        if (line.includes('for ') && !line.includes('range(')) {
            findings.push({
                type: 'unbounded_loop',
                severity: 'high',
                title: 'Potential Unbounded Loop',
                description: 'Loop without explicit bounds detected',
                line: lineNum,
                recommendation: 'Use bounded iteration or pagination'
            });
        }
    }

    // Check for missing access control on state-modifying functions
    const publicFuncMatch = code.match(/@public_function[\s\S]*?def\s+(\w+)/g);
    if (publicFuncMatch && hasStateModification && !hasAccessControl) {
        findings.push({
            type: 'access_control',
            severity: 'high',
            title: 'Missing Access Control',
            description: 'Public functions modify state without access control',
            recommendation: 'Add owner/admin checks using self.require()'
        });
    }

    // Check for missing events
    if (hasStateModification && !code.includes('self.event(')) {
        findings.push({
            type: 'missing_events',
            severity: 'low',
            title: 'Missing Event Emissions',
            description: 'State-changing functions should emit events',
            recommendation: 'Add self.event() calls for all state changes'
        });
    }

    // Calculate score
    let score = 100;
    for (const finding of findings) {
        if (finding.severity === 'critical') score -= 25;
        else if (finding.severity === 'high') score -= 15;
        else if (finding.severity === 'medium') score -= 10;
        else if (finding.severity === 'low') score -= 5;
    }
    score = Math.max(0, score);

    const riskLevel = score >= 90 ? 'LOW' : (score >= 70 ? 'MEDIUM' : (score >= 50 ? 'HIGH' : 'CRITICAL'));

    return {
        score,
        riskLevel,
        findings,
        summary: `Security Score: ${score}/100 | Risk Level: ${riskLevel} | Issues: ${findings.length}`
    };
}

// ============= API HANDLER =============

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, code, network = 'testnet' } = body;

        console.log(`🐍 PyMon API Request: [${action}]`);

        if (!code && action !== 'templates' && action !== 'config') {
            return NextResponse.json({
                success: false,
                error: 'Missing code in request'
            }, { status: 400 });
        }

        switch (action) {
            case 'compile': {
                // Parse and transpile Python to Solidity
                const analysis = parsePythonContract(code);

                if (!analysis) {
                    return NextResponse.json({
                        success: false,
                        error: 'Invalid Python contract. Must inherit from PySmartContract.',
                        stage: 'parsing'
                    }, { status: 400 });
                }

                const solidityCode = generateSolidity(analysis);
                const abi = generateABI(analysis);

                return NextResponse.json({
                    success: true,
                    contractName: analysis.name,
                    abi,
                    bytecode: '', // Will be compiled by Solidity compiler
                    solidityCode,
                    requiresSolidityCompilation: true,
                    metadata: {
                        compiler: 'pymon',
                        stateVariables: analysis.stateVars,
                        functions: analysis.functions.map(f => ({
                            name: f.name,
                            selector: f.selector,
                            visibility: 'public',
                            stateMutability: f.isPayable ? 'payable' : (f.isView ? 'view' : 'nonpayable')
                        }))
                    }
                });
            }

            case 'transpile': {
                const analysis = parsePythonContract(code);

                if (!analysis) {
                    return NextResponse.json({
                        success: false,
                        error: 'Invalid Python contract'
                    }, { status: 400 });
                }

                return NextResponse.json({
                    success: true,
                    solidity: generateSolidity(analysis),
                    contractName: analysis.name,
                    abi: generateABI(analysis)
                });
            }

            case 'validate': {
                const isValid = code.includes('PySmartContract') &&
                    (code.includes('@public_function') || code.includes('@view_function'));

                const classMatch = code.match(/class\s+(\w+)\s*\(/g);
                const contracts = classMatch ? classMatch.map((m: string) => m.replace(/class\s+|\s*\(/g, '')) : [];

                return NextResponse.json({
                    valid: isValid,
                    contracts,
                    message: isValid ? 'Valid PyMon contract' : 'Invalid contract structure'
                });
            }

            case 'audit': {
                const result = auditPythonContract(code);

                return NextResponse.json({
                    success: true,
                    ...result
                });
            }

            case 'templates': {
                return NextResponse.json({
                    success: true,
                    templates: PYTHON_TEMPLATES
                });
            }

            case 'config': {
                return NextResponse.json({
                    success: true,
                    network: MONAD_CONFIG[network as keyof typeof MONAD_CONFIG] || MONAD_CONFIG.testnet,
                    features: {
                        compile: true,
                        transpile: true,
                        audit: true,
                        deploy: true
                    }
                });
            }

            default:
                return NextResponse.json({
                    success: false,
                    error: `Unknown action: ${action}`
                }, { status: 400 });
        }

    } catch (error) {
            const message = error instanceof Error ? error.message : "Unexpected server error";
        console.error('❌ PyMon API Error:', error);
        return NextResponse.json({
            success: false,
            error: message || 'Internal server error'
        }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'templates') {
        return NextResponse.json({
            success: true,
            templates: PYTHON_TEMPLATES
        });
    }

    if (action === 'config') {
        return NextResponse.json({
            success: true,
            network: MONAD_CONFIG.testnet,
            features: {
                compile: true,
                transpile: true,
                audit: true,
                deploy: true
            }
        });
    }

    return NextResponse.json({
        success: true,
        service: 'PyMon API',
        version: '1.0.0',
        endpoints: {
            'POST /compile': 'Compile Python to EVM bytecode',
            'POST /transpile': 'Transpile Python to Solidity',
            'POST /validate': 'Validate Python contract',
            'POST /audit': 'Security audit',
            'GET /templates': 'Get contract templates',
            'GET /config': 'Get configuration'
        }
    });
}
