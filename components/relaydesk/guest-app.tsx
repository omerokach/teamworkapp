"use client";

import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import RelayDeskApp from "./relaydesk-app";

type Account = { user: { id: string; email: string; displayName: string }; isAdmin: boolean };
export default function GuestApp() {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<"email" | "code" | "name">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/account", { cache: "no-store" });
    if (r.ok) {
      const result = await r.json() as Account;
      setAccount(result);
      if (!result.user.displayName) setStep("name");
    }
    setReady(true);
  }, []);
  useEffect(() => { load().catch(() => { setError("Could not connect. Please refresh and try again."); setReady(true); }); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      let path: string;
      let body: Record<string, string>;
      if (step === "email") {
        const address = String(values.get("email") ?? "").trim().toLowerCase();
        setEmail(address);
        path = "/api/auth/email-otp/send-verification-otp";
        body = { email: address, type: "sign-in" };
      } else if (step === "code") {
        path = "/api/auth/sign-in/email-otp";
        body = { email, otp: String(values.get("code") ?? "").trim() };
      } else {
        path = "/api/account";
        body = { displayName: String(values.get("displayName") ?? "").trim() };
      }
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await r.json() as { error?: string | { message?: string }; message?: string };
      if (!r.ok || result.error) throw new Error((typeof result.error === "string" ? result.error : result.error?.message) ?? result.message ?? "Please try again.");
      if (step === "email") setStep("code");
      else await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    window.location.assign("/");
  }
  if (!ready) return <div className="guest-loading" aria-label="Opening RelayDesk"><span className="brand-mark large"><span /><span /></span></div>;
  if (account?.user.displayName) return <RelayDeskApp sessionUser={account.user} isAdmin={account.isAdmin} onSignOut={signOut} />;
  return <main className="guest-entry">
    <section className="guest-story">
      <div className="guest-wordmark"><span className="brand-mark"><span /><span /></span><strong>RelayDesk</strong></div>
      <div className="guest-copy"><p className="eyebrow">Your team. One shared workspace.</p><h1>Less chat.<br />More clarity.</h1><p>Keep tasks, owners, decisions, and conversations together—with a personal view of the work that’s yours.</p></div>
      <div className="guest-benefits"><span><CheckCircle2 size={17} />By invitation only</span><span><CheckCircle2 size={17} />Your account, on any device</span><span><CheckCircle2 size={17} />No password to remember</span></div>
    </section>
    <section className="guest-form-panel"><form className="guest-form" onSubmit={submit} key={step}>
      <span className="guest-icon"><ShieldCheck size={23} /></span>
      <p className="eyebrow">{step === "name" ? "Make it yours" : "Private team workspace"}</p>
      <h2>{step === "email" ? "Welcome to your team workspace" : step === "code" ? "Check your email" : "What should your team call you?"}</h2>
      <p>{step === "email" ? "Use the email address the workspace owner invited. We’ll send you a sign-in code." : step === "code" ? `Enter the one-time code sent to ${email}.` : `You’re signed in as ${account?.user.email}. Your name will stay the same on every device.`}</p>
      {step === "email" && <label><span>Email address</span><input name="email" type="email" maxLength={254} autoComplete="email" placeholder="you@example.com" required autoFocus /></label>}
      {step === "code" && <label><span>Verification code</span><input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="Enter your code" required autoFocus /></label>}
      {step === "name" && <label><span>Your name</span><input name="displayName" maxLength={60} autoComplete="name" placeholder="Your name" required autoFocus /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : <ArrowRight size={17} />}{step === "email" ? "Email me a sign-in code" : step === "code" ? "Verify and continue" : "Enter workspace"}</button>
      {step === "code" && <button className="text-button" type="button" disabled={busy} onClick={() => {setStep("email");setError("");}}>Use another email or request a new code</button>}
      {step === "name" && <button className="text-button" type="button" onClick={signOut}>Sign out</button>}
      <small>Only people invited by the workspace owner can enter.</small>
    </form></section>
  </main>;
}
