"""Regression test for the RPC-configuration bug: chain_preset(args.chain)
was used directly to build the Web3 connection, ignoring settings.rpc_url
entirely. That silently discarded any operator-configured RPC and always
hit the public preset endpoint, which is exactly what produced:

    Web3RPCError: {'code': -32005, 'message': 'limit exceeded'}

when indexing real block ranges against the public BSC testnet RPC.
"""

from agentx_worker.indexer.cli import resolve_rpc_url


def test_prefers_configured_rpc_url_over_preset():
    assert resolve_rpc_url("https://my-dedicated-rpc.example.com", "https://data-seed-prebsc-2-s2.binance.org:8545") == (
        "https://my-dedicated-rpc.example.com"
    )


def test_falls_back_to_preset_rpc_when_none_configured():
    assert resolve_rpc_url(None, "https://data-seed-prebsc-2-s2.binance.org:8545") == (
        "https://data-seed-prebsc-2-s2.binance.org:8545"
    )


def test_falls_back_to_preset_rpc_when_configured_is_empty_string():
    # Empty string is falsy in Python — treat it the same as unset, not as
    # "explicitly configured to nothing."
    assert resolve_rpc_url("", "https://data-seed-prebsc-2-s2.binance.org:8545") == (
        "https://data-seed-prebsc-2-s2.binance.org:8545"
    )
