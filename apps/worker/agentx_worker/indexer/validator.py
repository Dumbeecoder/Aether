"""Validates and normalizes an ERC-8004 registration file.

Schema is taken from the pinned bnbagent SDK's own
``AgentURIGenerator.generate_registration_file`` (apps/worker/.../resolver.py
docstring has the research notes). Per spec Section 7: missing fields are
valid, not errors — an agent that omits pricing or capabilities is not
malformed, it's just incomplete. We only reject genuinely unparseable JSON
(handled upstream by the resolver) or a payload that isn't a JSON object at
all.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class NormalizedService:
    name: str | None
    endpoint: str | None
    version: str | None
    capabilities: list[str]
    valid: bool
    reason: str | None = None


@dataclass
class NormalizedAgent:
    name: str | None
    description: str | None
    image: str | None
    services: list[NormalizedService]
    capabilities: list[str]  # deduped union across services
    supported_trust: list[str] | None
    is_registration_file: bool  # "type" matches the EIP-8004 registration-v1 URI
    warnings: list[str] = field(default_factory=list)


_REGISTRATION_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1"


def _clean_str(v) -> str | None:
    if isinstance(v, str) and v.strip():
        return v.strip()
    return None


def normalize_service(raw) -> NormalizedService:
    if not isinstance(raw, dict):
        return NormalizedService(
            name=None, endpoint=None, version=None, capabilities=[], valid=False,
            reason="service entry is not an object",
        )
    endpoint = _clean_str(raw.get("endpoint"))
    if endpoint is None:
        return NormalizedService(
            name=_clean_str(raw.get("name")), endpoint=None, version=None,
            capabilities=[], valid=False, reason="missing endpoint",
        )
    # Mirrors the SDK's own AgentEndpoint validation: only http(s) accepted.
    if not endpoint.startswith(("http://", "https://")):
        return NormalizedService(
            name=_clean_str(raw.get("name")), endpoint=endpoint, version=None,
            capabilities=[], valid=False, reason="endpoint is not http(s)",
        )
    caps = raw.get("capabilities")
    caps_list = [c for c in caps if isinstance(c, str)] if isinstance(caps, list) else []
    return NormalizedService(
        name=_clean_str(raw.get("name")),
        endpoint=endpoint,
        version=_clean_str(raw.get("version")),
        capabilities=caps_list,
        valid=True,
    )


def normalize_registration_file(raw: dict) -> NormalizedAgent:
    """Never raises. Bad/missing fields degrade to None/[] with a warning,
    matching Section 27: one malformed agent must not crash the indexer."""
    warnings: list[str] = []

    if not isinstance(raw, dict):
        return NormalizedAgent(
            name=None, description=None, image=None, services=[], capabilities=[],
            supported_trust=None, is_registration_file=False,
            warnings=["top-level payload is not a JSON object"],
        )

    is_registration_file = raw.get("type") == _REGISTRATION_TYPE
    if not is_registration_file:
        warnings.append(
            f"unexpected or missing 'type' (got {raw.get('type')!r}); "
            "treating fields as best-effort"
        )

    name = _clean_str(raw.get("name"))
    description = _clean_str(raw.get("description"))
    image = _clean_str(raw.get("image"))

    raw_services = raw.get("services")
    services: list[NormalizedService] = []
    if isinstance(raw_services, list):
        for entry in raw_services:
            svc = normalize_service(entry)
            services.append(svc)
            if not svc.valid:
                warnings.append(f"skipped invalid service entry: {svc.reason}")
    elif raw_services is not None:
        warnings.append("'services' present but not a list; ignored")

    capabilities: list[str] = []
    for svc in services:
        if svc.valid:
            for c in svc.capabilities:
                if c not in capabilities:
                    capabilities.append(c)

    supported_trust = raw.get("supportedTrust")
    supported_trust_list = (
        [s for s in supported_trust if isinstance(s, str)]
        if isinstance(supported_trust, list)
        else None
    )

    return NormalizedAgent(
        name=name,
        description=description,
        image=image,
        services=services,
        capabilities=capabilities,
        supported_trust=supported_trust_list,
        is_registration_file=is_registration_file,
        warnings=warnings,
    )
