from agentx_worker.indexer.slugs import build_slug, slugify


def test_slugify_basic():
    assert slugify("LiquidGuard AI") == "liquidguard-ai"


def test_slugify_strips_punctuation():
    assert slugify("Cake & Yield Bot!!") == "cake-yield-bot"


def test_slugify_empty_falls_back():
    assert slugify("") == "agent"
    assert slugify("!!!") == "agent"


def test_build_slug_includes_chain_and_agent_id_for_stability():
    slug = build_slug("LiquidGuard AI", 97, "18291")
    assert slug == "liquidguard-ai-97-18291"


def test_build_slug_handles_missing_name():
    slug = build_slug(None, 97, "42")
    assert slug == "agent-97-42"


def test_build_slug_collisions_are_impossible_for_distinct_agents():
    # Two differently-owned agents that happen to submit the same name
    # never collide because the on-chain agent_id is baked into the slug.
    a = build_slug("Yield Bot", 97, "1")
    b = build_slug("Yield Bot", 97, "2")
    assert a != b
