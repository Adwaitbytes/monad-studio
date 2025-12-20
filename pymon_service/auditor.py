# pymon_service/auditor.py
# Security Auditor for Python Smart Contracts

import ast
import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "informational"


class VulnerabilityType(Enum):
    REENTRANCY = "reentrancy"
    ACCESS_CONTROL = "access_control"
    INTEGER_OVERFLOW = "integer_overflow"
    UNCHECKED_CALL = "unchecked_call"
    DOS = "denial_of_service"
    TIMESTAMP_DEPENDENCE = "timestamp_dependence"
    UNSAFE_RANDOMNESS = "unsafe_randomness"
    FRONT_RUNNING = "front_running"
    UNPROTECTED_FUNCTION = "unprotected_function"
    HARDCODED_ADDRESS = "hardcoded_address"
    MISSING_VALIDATION = "missing_validation"
    STATE_CHANGE_AFTER_CALL = "state_change_after_call"
    UNBOUNDED_LOOP = "unbounded_loop"
    MISSING_EVENTS = "missing_events"
    GAS_OPTIMIZATION = "gas_optimization"


@dataclass
class AuditFinding:
    vulnerability_type: VulnerabilityType
    severity: Severity
    title: str
    description: str
    line_number: Optional[int] = None
    code_snippet: Optional[str] = None
    recommendation: str = ""
    gas_impact: Optional[str] = None


@dataclass
class AuditReport:
    contract_name: str
    score: int = 100
    findings: List[AuditFinding] = field(default_factory=list)
    summary: str = ""
    gas_optimizations: List[str] = field(default_factory=list)
    best_practices: List[str] = field(default_factory=list)


class ContractAuditor(ast.NodeVisitor):
    """AST-based security auditor for Python contracts"""

    def __init__(self, source_code: str):
        self.source_code = source_code
        self.lines = source_code.split('\n')
        self.findings: List[AuditFinding] = []
        self.current_function: Optional[str] = None
        self.current_class: Optional[str] = None

        # Tracking variables
        self.state_modifications: List[int] = []
        self.external_calls: List[int] = []
        self.loops: List[int] = []
        self.functions_with_access_control: set = set()
        self.public_functions: set = set()
        self.view_functions: set = set()
        self.events_emitted: set = set()
        self.state_variables: set = set()
        self.require_statements: List[int] = []

    def audit(self) -> AuditReport:
        """Perform security audit"""
        try:
            tree = ast.parse(self.source_code)
            self.visit(tree)
        except SyntaxError as e:
            self.findings.append(AuditFinding(
                vulnerability_type=VulnerabilityType.MISSING_VALIDATION,
                severity=Severity.CRITICAL,
                title="Syntax Error",
                description=f"Contract has syntax error at line {e.lineno}: {e.msg}",
                line_number=e.lineno,
                recommendation="Fix the syntax error before deployment"
            ))

        # Run additional checks
        self._check_reentrancy()
        self._check_access_control()
        self._check_missing_events()
        self._check_gas_optimizations()
        self._check_hardcoded_addresses()
        self._check_timestamp_dependence()

        # Calculate score
        score = self._calculate_score()

        # Generate summary
        summary = self._generate_summary()

        return AuditReport(
            contract_name=self.current_class or "Unknown",
            score=score,
            findings=self.findings,
            summary=summary,
            gas_optimizations=self._get_gas_recommendations(),
            best_practices=self._get_best_practices()
        )

    def visit_ClassDef(self, node: ast.ClassDef):
        """Visit class definition"""
        # Check if it's a contract
        is_contract = any(
            (isinstance(base, ast.Name) and base.id == "PySmartContract") or
            (isinstance(base, ast.Attribute) and base.attr == "PySmartContract")
            for base in node.bases
        )

        if is_contract:
            self.current_class = node.name
            self.generic_visit(node)
            self.current_class = None

    def visit_FunctionDef(self, node: ast.FunctionDef):
        """Visit function definition"""
        self.current_function = node.name

        # Check decorators
        is_public = False
        is_view = False
        is_payable = False

        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Name):
                if decorator.id == "public_function":
                    is_public = True
                    self.public_functions.add(node.name)
                elif decorator.id == "view_function":
                    is_view = True
                    self.view_functions.add(node.name)
                elif decorator.id == "payable_function":
                    is_payable = True
                    self.public_functions.add(node.name)

        # Check for access control in public functions
        if is_public and not is_view:
            has_access_control = self._has_access_control(node)
            if has_access_control:
                self.functions_with_access_control.add(node.name)
            elif node.name not in ["__init__", "constructor"]:
                # Check if it modifies state
                if self._modifies_state(node):
                    self.findings.append(AuditFinding(
                        vulnerability_type=VulnerabilityType.UNPROTECTED_FUNCTION,
                        severity=Severity.HIGH,
                        title=f"Unprotected State-Modifying Function: {node.name}",
                        description=f"Function '{node.name}' modifies state but has no access control",
                        line_number=node.lineno,
                        code_snippet=self._get_code_snippet(node.lineno),
                        recommendation="Add access control using self.require() with owner/admin check"
                    ))

        # Check for unbounded loops
        self._check_unbounded_loops(node)

        self.generic_visit(node)
        self.current_function = None

    def visit_Call(self, node: ast.Call):
        """Visit function calls"""
        # Track external calls
        if isinstance(node.func, ast.Attribute):
            if node.func.attr in ["transfer", "call", "delegatecall", "send"]:
                self.external_calls.append(node.lineno)

            # Track require statements
            if node.func.attr == "require":
                self.require_statements.append(node.lineno)

            # Track events
            if node.func.attr == "event":
                self.events_emitted.add(self.current_function)

            # Track state modifications
            if node.func.attr == "set_state":
                self.state_modifications.append(node.lineno)

        self.generic_visit(node)

    def visit_For(self, node: ast.For):
        """Visit for loops"""
        self.loops.append(node.lineno)
        self.generic_visit(node)

    def visit_While(self, node: ast.While):
        """Visit while loops"""
        self.loops.append(node.lineno)

        # Check for potential infinite loop
        if isinstance(node.test, ast.Constant) and node.test.value == True:
            self.findings.append(AuditFinding(
                vulnerability_type=VulnerabilityType.DOS,
                severity=Severity.CRITICAL,
                title="Potential Infinite Loop",
                description="While True loop detected - could cause denial of service",
                line_number=node.lineno,
                code_snippet=self._get_code_snippet(node.lineno),
                recommendation="Ensure loop has a proper exit condition"
            ))

        self.generic_visit(node)

    def _has_access_control(self, node: ast.FunctionDef) -> bool:
        """Check if function has access control"""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Attribute):
                    if child.func.attr == "require":
                        # Check if require contains owner/admin check
                        for arg in child.args:
                            arg_str = ast.dump(arg)
                            if any(kw in arg_str.lower() for kw in ["owner", "admin", "msg_sender"]):
                                return True
        return False

    def _modifies_state(self, node: ast.FunctionDef) -> bool:
        """Check if function modifies state"""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Attribute):
                    if child.func.attr in ["set_state", "transfer"]:
                        return True
            # Check for direct attribute assignment on self
            if isinstance(child, ast.Assign):
                for target in child.targets:
                    if isinstance(target, ast.Attribute):
                        if isinstance(target.value, ast.Name) and target.value.id == "self":
                            return True
        return False

    def _check_reentrancy(self):
        """Check for reentrancy vulnerabilities"""
        # State change after external call
        for ext_call_line in self.external_calls:
            for state_mod_line in self.state_modifications:
                if state_mod_line > ext_call_line:
                    self.findings.append(AuditFinding(
                        vulnerability_type=VulnerabilityType.REENTRANCY,
                        severity=Severity.CRITICAL,
                        title="Potential Reentrancy Vulnerability",
                        description=f"State modification at line {state_mod_line} occurs after external call at line {ext_call_line}",
                        line_number=ext_call_line,
                        recommendation="Use checks-effects-interactions pattern: update state before external calls"
                    ))
                    break

    def _check_access_control(self):
        """Check for access control issues"""
        state_modifying_without_control = self.public_functions - self.functions_with_access_control - self.view_functions
        # Already handled in visit_FunctionDef

    def _check_missing_events(self):
        """Check for missing events on state changes"""
        state_modifying = self.public_functions - self.view_functions
        without_events = state_modifying - self.events_emitted

        for func in without_events:
            if func not in ["__init__", "constructor"]:
                self.findings.append(AuditFinding(
                    vulnerability_type=VulnerabilityType.MISSING_EVENTS,
                    severity=Severity.LOW,
                    title=f"Missing Event Emission: {func}",
                    description=f"Function '{func}' modifies state but doesn't emit events",
                    recommendation="Emit events for all state changes to enable off-chain tracking"
                ))

    def _check_gas_optimizations(self):
        """Check for gas optimization opportunities"""
        # Check for loops that could be expensive
        if self.loops:
            self.findings.append(AuditFinding(
                vulnerability_type=VulnerabilityType.GAS_OPTIMIZATION,
                severity=Severity.INFO,
                title="Loop Detected",
                description=f"Loops detected at lines: {self.loops}. Ensure bounded iteration.",
                recommendation="Use fixed-size loops or pagination for large datasets"
            ))

    def _check_hardcoded_addresses(self):
        """Check for hardcoded addresses"""
        address_pattern = r'0x[a-fA-F0-9]{40}'
        for i, line in enumerate(self.lines, 1):
            matches = re.findall(address_pattern, line)
            for match in matches:
                if match != "0x0000000000000000000000000000000000000000":
                    self.findings.append(AuditFinding(
                        vulnerability_type=VulnerabilityType.HARDCODED_ADDRESS,
                        severity=Severity.MEDIUM,
                        title="Hardcoded Address",
                        description=f"Hardcoded address found: {match}",
                        line_number=i,
                        code_snippet=line.strip(),
                        recommendation="Use configurable addresses or constructor parameters"
                    ))

    def _check_timestamp_dependence(self):
        """Check for timestamp dependence"""
        for i, line in enumerate(self.lines, 1):
            if "block_timestamp" in line or "block.timestamp" in line:
                self.findings.append(AuditFinding(
                    vulnerability_type=VulnerabilityType.TIMESTAMP_DEPENDENCE,
                    severity=Severity.MEDIUM,
                    title="Timestamp Dependence",
                    description="Contract relies on block timestamp which can be manipulated by miners",
                    line_number=i,
                    recommendation="Avoid using timestamps for critical logic; use block numbers instead"
                ))
                break

    def _check_unbounded_loops(self, node: ast.FunctionDef):
        """Check for unbounded loops in function"""
        for child in ast.walk(node):
            if isinstance(child, ast.For):
                # Check if iterating over user-controlled data
                if isinstance(child.iter, ast.Call):
                    if isinstance(child.iter.func, ast.Name):
                        if child.iter.func.id in ["range", "len"]:
                            # Check arguments
                            for arg in child.iter.args:
                                if self._is_user_controlled(arg):
                                    self.findings.append(AuditFinding(
                                        vulnerability_type=VulnerabilityType.UNBOUNDED_LOOP,
                                        severity=Severity.HIGH,
                                        title="Unbounded Loop",
                                        description=f"Loop in '{node.name}' iterates over potentially user-controlled data",
                                        line_number=child.lineno,
                                        recommendation="Set maximum iteration limits to prevent DoS"
                                    ))

    def _is_user_controlled(self, node: ast.expr) -> bool:
        """Check if expression could be user-controlled"""
        # Simplified check - could be more sophisticated
        if isinstance(node, ast.Call):
            return True
        if isinstance(node, ast.Attribute):
            return True
        return False

    def _calculate_score(self) -> int:
        """Calculate security score (0-100)"""
        score = 100
        for finding in self.findings:
            if finding.severity == Severity.CRITICAL:
                score -= 25
            elif finding.severity == Severity.HIGH:
                score -= 15
            elif finding.severity == Severity.MEDIUM:
                score -= 10
            elif finding.severity == Severity.LOW:
                score -= 5
            # INFO doesn't reduce score
        return max(0, score)

    def _generate_summary(self) -> str:
        """Generate audit summary"""
        critical = sum(1 for f in self.findings if f.severity == Severity.CRITICAL)
        high = sum(1 for f in self.findings if f.severity == Severity.HIGH)
        medium = sum(1 for f in self.findings if f.severity == Severity.MEDIUM)
        low = sum(1 for f in self.findings if f.severity == Severity.LOW)
        info = sum(1 for f in self.findings if f.severity == Severity.INFO)

        score = self._calculate_score()

        if score >= 90:
            risk_level = "LOW"
        elif score >= 70:
            risk_level = "MEDIUM"
        elif score >= 50:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        return f"""Security Audit Summary
======================
Contract: {self.current_class or 'Unknown'}
Security Score: {score}/100
Risk Level: {risk_level}

Findings:
- Critical: {critical}
- High: {high}
- Medium: {medium}
- Low: {low}
- Informational: {info}

Total Issues: {len(self.findings)}
"""

    def _get_gas_recommendations(self) -> List[str]:
        """Get gas optimization recommendations"""
        recommendations = []
        if self.loops:
            recommendations.append("Consider using fixed-size arrays instead of dynamic arrays in loops")
        if len(self.state_modifications) > 3:
            recommendations.append("Multiple state modifications detected - consider batching updates")
        return recommendations

    def _get_best_practices(self) -> List[str]:
        """Get best practice recommendations"""
        practices = []
        if not self.events_emitted:
            practices.append("Emit events for all state-changing operations")
        if len(self.public_functions) > len(self.functions_with_access_control):
            practices.append("Add access control to all sensitive functions")
        practices.append("Use the checks-effects-interactions pattern")
        practices.append("Implement proper input validation")
        return practices

    def _get_code_snippet(self, line_number: int, context: int = 2) -> str:
        """Get code snippet around line number"""
        start = max(0, line_number - context - 1)
        end = min(len(self.lines), line_number + context)
        snippet_lines = []
        for i in range(start, end):
            prefix = ">>> " if i == line_number - 1 else "    "
            snippet_lines.append(f"{prefix}{i+1}: {self.lines[i]}")
        return "\n".join(snippet_lines)


# ============= CONVENIENCE FUNCTIONS =============

def audit_python_contract(source_code: str) -> Dict[str, Any]:
    """
    Audit a Python smart contract for security issues.

    Args:
        source_code: Python contract source code

    Returns:
        Audit report as dictionary
    """
    auditor = ContractAuditor(source_code)
    report = auditor.audit()

    return {
        "success": True,
        "contractName": report.contract_name,
        "score": report.score,
        "riskLevel": "LOW" if report.score >= 90 else ("MEDIUM" if report.score >= 70 else ("HIGH" if report.score >= 50 else "CRITICAL")),
        "summary": report.summary,
        "findings": [
            {
                "type": f.vulnerability_type.value,
                "severity": f.severity.value,
                "title": f.title,
                "description": f.description,
                "line": f.line_number,
                "code": f.code_snippet,
                "recommendation": f.recommendation,
                "gasImpact": f.gas_impact
            }
            for f in report.findings
        ],
        "gasOptimizations": report.gas_optimizations,
        "bestPractices": report.best_practices,
        "statistics": {
            "critical": sum(1 for f in report.findings if f.severity == Severity.CRITICAL),
            "high": sum(1 for f in report.findings if f.severity == Severity.HIGH),
            "medium": sum(1 for f in report.findings if f.severity == Severity.MEDIUM),
            "low": sum(1 for f in report.findings if f.severity == Severity.LOW),
            "info": sum(1 for f in report.findings if f.severity == Severity.INFO),
            "total": len(report.findings)
        }
    }
