from fastapi.testclient import TestClient

from agentx_worker.main import app

client = TestClient(app)


def test_health_is_public_and_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "agentx-worker"
    assert body["status"] == "ok"
