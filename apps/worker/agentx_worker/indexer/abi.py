"""ERC-8004 Identity Registry ABI fragment and contract helper.

The events below (Registered, URIUpdated, MetadataSet, Transfer) and the
three read functions (tokenURI, ownerOf, getAgentWallet) were extracted
directly from the ABI shipped inside the pinned ``bnbagent==0.3.6`` package
(``bnbagent/erc8004/abis/IdentityRegistry.json``) — not assumed or
reconstructed from general ERC-721/EIP-8004 knowledge. Re-verify against
the installed package if the pin is ever bumped:

    python -c "import bnbagent, os; print(os.path.dirname(bnbagent.__file__))"

We only carry the subset of the contract surface the indexer actually uses.
The full ABI also includes standard ERC-721 (Approval, ApprovalForAll),
ERC-4906 (MetadataUpdate, BatchMetadataUpdate — refresh signals with no
payload), and contract-admin events (Initialized, Upgraded,
OwnershipTransferred, EIP712DomainChanged) which are not agent-identity
events and are intentionally excluded.
"""

from __future__ import annotations

import json
from pathlib import Path

from web3 import Web3
from web3.contract import Contract

_ABI_PATH = Path(__file__).parent / "identity_registry_abi.json"

with open(_ABI_PATH) as _f:
    IDENTITY_REGISTRY_ABI: list[dict] = json.load(_f)

# Every event this indexer watches. Order matters for get_logs batching.
WATCHED_EVENTS = ("Registered", "URIUpdated", "MetadataSet", "Transfer")


def get_registry_contract(web3: Web3, address: str) -> Contract:
    return web3.eth.contract(address=Web3.to_checksum_address(address), abi=IDENTITY_REGISTRY_ABI)
