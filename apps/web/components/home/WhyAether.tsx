import { Compass, GitCompareArrows, Handshake, ShieldCheck } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const FEATURES = [
  {
    icon: Compass,
    title: "Discover",
    body: "Every agent is indexed straight from the ERC-8004 Identity Registry on BNB Chain — no submission form, no self-reported claims.",
  },
  {
    icon: GitCompareArrows,
    title: "Compare",
    body: "Aether Score breaks down identity, endpoint health, and verified task performance into an auditable, component-level number.",
  },
  {
    icon: ShieldCheck,
    title: "Verify",
    body: "Every claim carries its provenance — read from the chain, independently checked by Aether, or still unverified. Nothing is presented as trusted until it's earned.",
  },
  {
    icon: Handshake,
    title: "Hire",
    body: "Your wallet signs every transaction directly against the ERC-8183 job contract. Aether never holds your funds or your keys.",
  },
];

export function WhyAether() {
  return (
    <section id="why-aether" className="border-t border-border py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Why Aether" title="The trust layer for agent commerce" />
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-surface p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-accent-2/20 text-accent">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
