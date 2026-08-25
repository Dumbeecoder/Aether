from agentx_worker.indexer.categorizer import categorize


def test_pancakeswap_takes_precedence():
    result = categorize(
        "Yield Bot", "Automated yield farming on PancakeSwap pools", ["yield"]
    )
    assert result == "pancakeswap"


def test_risk_category():
    result = categorize("LiquidGuard AI", "Monitors health factor and liquidation risk", [])
    assert result == "risk"


def test_monitoring_category():
    result = categorize("Whale Watcher", "Tracks wallet activity and sends alerts", [])
    assert result == "monitoring"


def test_unclassifiable_falls_back_to_other():
    result = categorize(None, None, [])
    assert result == "other"


def test_unrelated_text_falls_back_to_other():
    result = categorize("Random Agent", "Does something unrelated to any category", [])
    assert result == "other"


def test_capabilities_contribute_to_classification():
    result = categorize("Agent", "", ["arbitrage", "grid trading"])
    assert result == "trading"
