// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

/**
 * @title MetaverseDAO
 * @dev Governance contract optimized for metaverse decision-making on Monad
 * Fast voting periods leverage Monad's high TPS
 */
contract MetaverseDAO is Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes {
    
    constructor(IVotes _token)
        Governor("MetaverseDAO")
        GovernorSettings(
            1, /* 1 block voting delay */
            300, /* ~5 min voting period on Monad (high TPS) */
            0 /* 0 proposal threshold */
        )
        GovernorVotes(_token)
    {}
    
    // Required overrides
    function votingDelay()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }
    
    function votingPeriod()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }
    
    function quorum(uint256 blockNumber)
        public
        pure
        override
        returns (uint256)
    {
        return 1000e18; // 1000 tokens quorum
    }
    
    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }
}
