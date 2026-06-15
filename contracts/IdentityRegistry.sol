// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Lode ERC-8004 IdentityRegistry
/// @notice Minimal trustless-agent identity registry for the Lode agent economy.
/// Each agent registers an identity document URI and receives a monotonic agent
/// id. Identities are queryable on-chain, anchoring agent reputation to Mantle
/// while the economy executes on Solana/Byreal.
contract IdentityRegistry {
    struct Agent {
        uint256 id;
        address owner;
        string agentURI; // did:lode:<solana-pubkey>#label
        uint256 registeredAt;
    }

    uint256 public nextId = 1;
    mapping(uint256 => Agent) public agents;
    mapping(address => uint256[]) public agentsByOwner;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentUpdated(uint256 indexed agentId, string agentURI);

    /// @notice Register a new agent identity. Returns the assigned agent id.
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = nextId++;
        agents[agentId] = Agent({
            id: agentId,
            owner: msg.sender,
            agentURI: agentURI,
            registeredAt: block.timestamp
        });
        agentsByOwner[msg.sender].push(agentId);
        emit AgentRegistered(agentId, msg.sender, agentURI);
    }

    /// @notice Update the identity document for an agent you own.
    function update(uint256 agentId, string calldata agentURI) external {
        require(agents[agentId].owner == msg.sender, "not owner");
        agents[agentId].agentURI = agentURI;
        emit AgentUpdated(agentId, agentURI);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }

    function totalAgents() external view returns (uint256) {
        return nextId - 1;
    }
}
