import { Burst } from "./art";

type Kind = "missing" | "pending" | "rejected" | "banned" | "error";

const TEXT: Record<Kind, { title: string; body: (x?: string) => string }> = {
  missing: {
    title: "Pehle Pryielle MSG me account banao",
    body: () => "Pryielle AI wahi account use karta hai jo Pryielle MSG me hai. MSG app me is Google ID se account banao, owner approve kare, phir yahan aao.",
  },
  pending: {
    title: "Approval pending",
    body: () => "Tumhari request owner ke paas hai. Approve hote hi Pryielle AI khul jayega.",
  },
  rejected: {
    title: "Request reject hui",
    body: (x) => (x ? `Reason: ${x}` : "Owner ne tumhari request approve nahi ki."),
  },
  banned: {
    title: "Account banned",
    body: (x) => (x ? `Reason: ${x}` : "Is account par ban laga hai."),
  },
  error: {
    title: "Connect nahi ho paya",
    body: (x) => x || "Internet check karke dobara try karo.",
  },
};

export function Gate({ kind, detail, onRetry, onLogout }: { kind: Kind; detail?: string; onRetry?: () => void; onLogout: () => void }) {
  const t = TEXT[kind];
  return (
    <main className="gate">
      <Burst size={64} />
      <h1>{t.title}</h1>
      <p>{t.body(detail)}</p>
      {onRetry ? (
        <button type="button" className="gbtn" onClick={onRetry}>
          Retry
        </button>
      ) : null}
      <button type="button" className="ghost" onClick={onLogout}>
        Sign out
      </button>
    </main>
  );
}
