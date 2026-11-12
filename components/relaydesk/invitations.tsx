"use client";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, MailPlus } from "lucide-react";
type Invite = { email: string; displayName: string; status: string; expiresAt: string };
export default function Invitations() {
  const [items, setItems] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/invitations", { cache: "no-store" });
    const p = await r.json() as { invitations: Invite[]; error?: string };
    if (!r.ok) throw new Error(p.error ?? "Could not load invitations.");
    setItems(p.invitations);
  }, []);
  useEffect(() => { load().catch(e => setMessage(e.message)); }, [load]);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const p = await r.json() as { error?: string }; if (!r.ok) throw new Error(p.error);
      setMessage(`Invitation emailed to ${email}.`); form.reset(); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not invite this person."); }
    finally { setBusy(false); }
  }
  async function revoke(email: string) {
    if (!window.confirm(`Remove workspace access for ${email}?`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/invitations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const p = await r.json() as { error?: string }; if (!r.ok) throw new Error(p.error);
      await load(); setMessage(`Access removed for ${email}.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not remove access."); }
    finally { setBusy(false); }
  }
  return <section className="invitation-settings">
    <div className="section-heading"><div><p className="eyebrow">Owner controls</p><h2>Invite people by email</h2><p>They verify their email and choose their own name. Only you can grant access.</p></div></div>
    <form className="invite-form" onSubmit={invite}><input name="email" type="email" maxLength={254} placeholder="partner@example.com" aria-label="Partner email address" required /><button className="button primary" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : <MailPlus size={17} />}Send invitation</button></form>
    {message && <p role="status" className="invite-message">{message}</p>}
    <div className="access-list">{items.map(item => <div className="access-row" key={item.email}><span><strong>{item.displayName || item.email}</strong>{item.displayName && <small>{item.email}</small>}</span><span className="access-status">{item.status === "invited" && new Date(item.expiresAt).getTime() < Date.now() ? "Expired" : item.status}</span>{item.status !== "revoked" && <button className="text-button" disabled={busy} onClick={() => revoke(item.email)}>Remove access</button>}</div>)}</div>
  </section>;
}
