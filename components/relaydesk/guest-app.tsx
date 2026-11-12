"use client";

import { ArrowRight, CheckCircle2, UsersRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import RelayDeskApp from "./relaydesk-app";

type GuestIdentity = {
  id: string;
  email: string;
  displayName: string;
};

const STORAGE_KEY = "relaydesk_guest_identity_v1";

export default function GuestApp() {
  const [identity, setIdentity] = useState<GuestIdentity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GuestIdentity;
        if (parsed.id && parsed.displayName) setIdentity(parsed);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  function enterWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") ?? "").trim().slice(0, 60);
    if (!displayName) return;

    const id = crypto.randomUUID();
    const nextIdentity = {
      id,
      email: `${id}@relaydesk.local`,
      displayName,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextIdentity));
    setIdentity(nextIdentity);
  }

  if (!ready) {
    return (
      <div className="guest-loading" aria-label="Opening RelayDesk">
        <span className="brand-mark large" aria-hidden="true"><span /><span /></span>
      </div>
    );
  }

  if (identity) return <RelayDeskApp sessionUser={identity} />;

  return (
    <main className="guest-entry">
      <section className="guest-story">
        <div className="guest-wordmark">
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          <strong>RelayDesk</strong>
        </div>
        <div className="guest-copy">
          <p className="eyebrow">One shared place for the work</p>
          <h1>Less chat.<br />More clarity.</h1>
          <p>Tasks, owners, decisions, and conversations stay connected—so your team always knows what happens next.</p>
        </div>
        <div className="guest-benefits">
          <span><CheckCircle2 size={17} />No account or password</span>
          <span><CheckCircle2 size={17} />Shared live workspace</span>
          <span><CheckCircle2 size={17} />Works on phone and desktop</span>
        </div>
      </section>

      <section className="guest-form-panel">
        <form className="guest-form" onSubmit={enterWorkspace}>
          <span className="guest-icon"><UsersRound size={23} /></span>
          <p className="eyebrow">Join the workspace</p>
          <h2>What should your team call you?</h2>
          <p>Enter your name once. RelayDesk will remember you on this device.</p>
          <label>
            <span>Display name</span>
            <input name="displayName" maxLength={60} placeholder="Your name" autoComplete="name" required />
          </label>
          <button className="button primary" type="submit">
            Enter workspace <ArrowRight size={17} />
          </button>
          <small>No account required. Anyone with the workspace link can enter.</small>
        </form>
      </section>
    </main>
  );
}
