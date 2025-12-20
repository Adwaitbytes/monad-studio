# pymon_service/py_contracts.py
# PySmartContract base class and decorators for Python smart contracts

from typing import Any, Dict, List, Callable, Optional
from functools import wraps
import hashlib
import json

# Storage slot counter for deterministic storage layout
_storage_slot_counter = 0

def _get_next_slot() -> int:
    global _storage_slot_counter
    slot = _storage_slot_counter
    _storage_slot_counter += 1
    return slot

def _reset_slots():
    global _storage_slot_counter
    _storage_slot_counter = 0


# ============= DECORATORS =============

def public_function(func: Callable) -> Callable:
    """Mark a function as public (state-modifying)"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    wrapper._is_public = True
    wrapper._is_view = False
    wrapper._is_payable = False
    return wrapper


def view_function(func: Callable) -> Callable:
    """Mark a function as view (read-only, no gas for calls)"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    wrapper._is_public = True
    wrapper._is_view = True
    wrapper._is_payable = False
    return wrapper


def payable_function(func: Callable) -> Callable:
    """Mark a function as payable (can receive MON)"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    wrapper._is_public = True
    wrapper._is_view = False
    wrapper._is_payable = True
    return wrapper


def internal_function(func: Callable) -> Callable:
    """Mark a function as internal (not callable externally)"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    wrapper._is_public = False
    wrapper._is_view = False
    wrapper._is_payable = False
    return wrapper


# ============= BASE CONTRACT CLASS =============

class PySmartContract:
    """
    Base class for Python smart contracts.
    Provides EVM-compatible state management and blockchain context.
    """

    def __init__(self):
        self._state: Dict[str, Any] = {}
        self._storage_slots: Dict[str, int] = {}
        self._events: List[Dict] = []
        self._msg_sender: str = "0x0000000000000000000000000000000000000000"
        self._msg_value: int = 0
        self._block_timestamp: int = 0
        self._block_number: int = 0
        self._tx_origin: str = "0x0000000000000000000000000000000000000000"
        self._contract_address: str = "0x0000000000000000000000000000000000000000"
        self._balance: int = 0

    # ============= STATE VARIABLE HELPERS =============

    def state_var(self, name: str, initial_value: Any = None, var_type: str = "uint256") -> Any:
        """
        Declare a state variable with type annotation.

        Args:
            name: Variable name
            initial_value: Initial value
            var_type: Solidity type (uint256, address, bool, string, etc.)

        Returns:
            The current value of the state variable
        """
        if name not in self._storage_slots:
            self._storage_slots[name] = _get_next_slot()

        if name not in self._state:
            self._state[name] = initial_value

        return self._state[name]

    def set_state(self, name: str, value: Any):
        """Set a state variable value"""
        self._state[name] = value

    def get_state(self, name: str) -> Any:
        """Get a state variable value"""
        return self._state.get(name)

    def mapping(self, name: str, key_type: str = "address", value_type: str = "uint256") -> Dict:
        """
        Declare a mapping state variable.

        Args:
            name: Mapping name
            key_type: Key type (address, uint256, etc.)
            value_type: Value type

        Returns:
            Dictionary representing the mapping
        """
        if name not in self._storage_slots:
            self._storage_slots[name] = _get_next_slot()

        if name not in self._state:
            self._state[name] = {}

        return self._state[name]

    # ============= BLOCKCHAIN CONTEXT =============

    def msg_sender(self) -> str:
        """Get the address of the message sender"""
        return self._msg_sender

    def msg_value(self) -> int:
        """Get the amount of MON sent with the transaction (in wei)"""
        return self._msg_value

    def block_timestamp(self) -> int:
        """Get the current block timestamp"""
        return self._block_timestamp

    def block_number(self) -> int:
        """Get the current block number"""
        return self._block_number

    def tx_origin(self) -> str:
        """Get the original transaction sender"""
        return self._tx_origin

    def address(self) -> str:
        """Get this contract's address"""
        return self._contract_address

    def balance(self) -> int:
        """Get this contract's MON balance (in wei)"""
        return self._balance

    # ============= UTILITIES =============

    def require(self, condition: bool, message: str = "Requirement not met"):
        """
        Require a condition to be true, revert otherwise.

        Args:
            condition: Boolean condition
            message: Error message if condition is false
        """
        if not condition:
            raise Exception(f"REVERT: {message}")

    def event(self, name: str, **kwargs):
        """
        Emit an event.

        Args:
            name: Event name
            **kwargs: Event parameters
        """
        self._events.append({
            "name": name,
            "params": kwargs,
            "block": self._block_number,
            "timestamp": self._block_timestamp
        })

    def keccak256(self, data: bytes) -> bytes:
        """Compute keccak256 hash"""
        return hashlib.sha3_256(data).digest()

    def transfer(self, to: str, amount: int) -> bool:
        """
        Transfer MON to an address.

        Args:
            to: Recipient address
            amount: Amount in wei

        Returns:
            True if successful
        """
        self.require(self._balance >= amount, "Insufficient balance")
        self._balance -= amount
        return True

    # ============= INTERNAL CONTEXT SETTERS =============

    def _set_context(self, sender: str = None, value: int = 0, timestamp: int = 0,
                     block_num: int = 0, origin: str = None, contract_addr: str = None):
        """Set the execution context (called by runtime)"""
        if sender:
            self._msg_sender = sender
        self._msg_value = value
        self._block_timestamp = timestamp
        self._block_number = block_num
        if origin:
            self._tx_origin = origin
        if contract_addr:
            self._contract_address = contract_addr


# ============= SAMPLE CONTRACTS =============

class SimpleStorage(PySmartContract):
    """Example: Simple storage contract"""

    def __init__(self):
        super().__init__()
        self.stored_value = self.state_var("stored_value", 0, "uint256")
        self.owner = self.state_var("owner", self.msg_sender(), "address")

    @public_function
    def store(self, value: int):
        """Store a value"""
        self.set_state("stored_value", value)
        self.event("ValueStored", value=value, sender=self.msg_sender())

    @view_function
    def retrieve(self) -> int:
        """Retrieve the stored value"""
        return self.get_state("stored_value")


class Counter(PySmartContract):
    """Example: Counter contract"""

    def __init__(self):
        super().__init__()
        self.count = self.state_var("count", 0, "uint256")

    @public_function
    def increment(self):
        """Increment counter by 1"""
        current = self.get_state("count")
        self.set_state("count", current + 1)
        self.event("CountChanged", new_value=current + 1)

    @public_function
    def decrement(self):
        """Decrement counter by 1"""
        current = self.get_state("count")
        self.require(current > 0, "Counter cannot go below zero")
        self.set_state("count", current - 1)
        self.event("CountChanged", new_value=current - 1)

    @view_function
    def get_count(self) -> int:
        """Get current count"""
        return self.get_state("count")


class BasicToken(PySmartContract):
    """Example: Basic ERC20-like token"""

    def __init__(self):
        super().__init__()
        self.name = self.state_var("name", "PyMon Token", "string")
        self.symbol = self.state_var("symbol", "PYMON", "string")
        self.decimals = self.state_var("decimals", 18, "uint8")
        self.total_supply = self.state_var("total_supply", 0, "uint256")
        self.balances = self.mapping("balances", "address", "uint256")
        self.allowances = self.mapping("allowances", "address", "mapping(address => uint256)")
        self.owner = self.state_var("owner", "", "address")

    @public_function
    def initialize(self, initial_supply: int):
        """Initialize token with initial supply"""
        self.set_state("owner", self.msg_sender())
        self.set_state("total_supply", initial_supply * (10 ** 18))
        balances = self.get_state("balances")
        balances[self.msg_sender()] = initial_supply * (10 ** 18)
        self.event("Transfer", from_addr="0x0", to=self.msg_sender(), amount=initial_supply * (10 ** 18))

    @view_function
    def balance_of(self, account: str) -> int:
        """Get balance of an account"""
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
        """Mint new tokens (only owner)"""
        self.require(self.msg_sender() == self.get_state("owner"), "Only owner can mint")

        balances = self.get_state("balances")
        balances[to] = balances.get(to, 0) + amount
        self.set_state("total_supply", self.get_state("total_supply") + amount)

        self.event("Transfer", from_addr="0x0", to=to, amount=amount)


def get_sample_contracts() -> Dict[str, str]:
    """Get sample contract source code strings"""
    return {
        "SimpleStorage": '''from pymon_service.py_contracts import PySmartContract, public_function, view_function

class SimpleStorage(PySmartContract):
    """Simple storage contract for Monad"""

    def __init__(self):
        super().__init__()
        self.stored_value = self.state_var("stored_value", 0, "uint256")
        self.owner = self.state_var("owner", self.msg_sender(), "address")

    @public_function
    def store(self, value: int):
        """Store a value"""
        self.set_state("stored_value", value)
        self.event("ValueStored", value=value, sender=self.msg_sender())

    @view_function
    def retrieve(self) -> int:
        """Retrieve the stored value"""
        return self.get_state("stored_value")
''',
        "Counter": '''from pymon_service.py_contracts import PySmartContract, public_function, view_function

class Counter(PySmartContract):
    """Counter contract for Monad"""

    def __init__(self):
        super().__init__()
        self.count = self.state_var("count", 0, "uint256")

    @public_function
    def increment(self):
        """Increment counter by 1"""
        current = self.get_state("count")
        self.set_state("count", current + 1)
        self.event("CountChanged", new_value=current + 1)

    @public_function
    def decrement(self):
        """Decrement counter by 1"""
        current = self.get_state("count")
        self.require(current > 0, "Counter cannot go below zero")
        self.set_state("count", current - 1)

    @view_function
    def get_count(self) -> int:
        """Get current count"""
        return self.get_state("count")
''',
        "BasicToken": '''from pymon_service.py_contracts import PySmartContract, public_function, view_function

class BasicToken(PySmartContract):
    """Basic ERC20-like token for Monad"""

    def __init__(self):
        super().__init__()
        self.name = self.state_var("name", "My Token", "string")
        self.symbol = self.state_var("symbol", "MTK", "string")
        self.decimals = self.state_var("decimals", 18, "uint8")
        self.total_supply = self.state_var("total_supply", 1000000 * 10**18, "uint256")
        self.balances = self.mapping("balances", "address", "uint256")
        self.owner = self.state_var("owner", self.msg_sender(), "address")

    @view_function
    def balance_of(self, account: str) -> int:
        """Get token balance of an account"""
        balances = self.get_state("balances")
        return balances.get(account, 0)

    @public_function
    def transfer(self, to: str, amount: int) -> bool:
        """Transfer tokens"""
        balances = self.get_state("balances")
        sender = self.msg_sender()
        self.require(balances.get(sender, 0) >= amount, "Insufficient balance")
        balances[sender] -= amount
        balances[to] = balances.get(to, 0) + amount
        self.event("Transfer", from_addr=sender, to=to, amount=amount)
        return True

    @public_function
    def mint(self, to: str, amount: int):
        """Mint new tokens (owner only)"""
        self.require(self.msg_sender() == self.get_state("owner"), "Only owner")
        balances = self.get_state("balances")
        balances[to] = balances.get(to, 0) + amount
        self.set_state("total_supply", self.get_state("total_supply") + amount)
'''
    }
