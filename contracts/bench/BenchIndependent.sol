// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Every caller mutates its own storage slot.
 *
 * Identical work to BenchContended -- one storage read, one add, one write --
 * but keyed by sender, so two transactions from different accounts never touch
 * the same slot. The profiler grades this as parallelisable. Holding the work
 * constant and varying only the slot is what isolates contention from cost.
 */
contract BenchIndependent {
    mapping(address => uint256) public counters;

    function touch() external {
        counters[msg.sender] += 1;
    }
}
