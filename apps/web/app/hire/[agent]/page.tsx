import { notFound } from "next/navigation";
import { getAgentBySlug } from "@/lib/agents";
import { HireAgentFlow } from "@/components/HireAgentFlow";

export default async function HireAgentPage({ params }: { params: Promise<{ agent: string }> }) {
  const { agent: slug } = await params;
  const result = await getAgentBySlug(slug);

  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
        {result.status === "not_configured" ? "Supabase isn't connected yet." : result.message}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <HireAgentFlow
        agentSlug={result.agent.slug}
        agentName={result.agent.name}
        agentWallet={result.agent.walletAddress as `0x${string}`}
      />
    </div>
  );
}
