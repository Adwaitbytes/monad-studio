// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Every call mutates the same storage slot.
 *
 * On a parallel EVM this is the worst case: no two transactions against this
 * contract can be applied concurrently, because both read and write the same
 * slot. The profiler grades this pattern as a hard conflict, and this contract
 * exists to test whether that grade corresponds to anything measurable.
 */
contract BenchContended {
    uint256 public counter;

    function touch() external {
        counter += 1;
    }
}
