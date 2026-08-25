import { NextResponse } from "next/server";

// Basic liveness check for the web app. Does not touch Supabase or the
// worker yet — that's added once those integrations exist (Phase 2+),
// so a green health check here never implies "database reachable".
export async function GET() {
  return NextResponse.json({
    service: "aether-web",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
