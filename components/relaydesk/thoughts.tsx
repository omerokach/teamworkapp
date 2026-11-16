"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, Lightbulb, Loader2, Plus, Search } from "lucide-react";

type Thought = {
  id: string; body: string; notes: string; authorId: string; authorName: string;
  discussedAt: string | null; createdAt: string;
};
type Updates = { body?: string; notes?: string; discussed?: boolean };

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Thoughts({ currentUserId, isAdmin, search }: { currentUserId: string; isAdmin: boolean; search: string }) {
  const [items, setItems] = useState<Thought[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"open" | "discussed">("open");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/thoughts", { cache: "no-store" });
      const payload = await response.json() as { thoughts: Thought[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load thoughts.");
      setItems(payload.thoughts);
      setLoaded(true);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load thoughts."); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const payload = await response.json() as { thought: Thought; error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not save. Please try again.");
    return payload;
  }

  async function mutate(action: () => Promise<void>, success: string) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save. Please try again.");
      return false;
    } finally { pending.current = false; setBusy(false); }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    await mutate(async () => {
      const payload = await save("/api/thoughts", "POST", { body: draft });
      setItems(current => [payload.thought, ...current]);
      setDraft("");
      setFilter("open");
      inputRef.current?.focus();
    }, "Thought added to To discuss.");
  }

  async function update(item: Thought, updates: Updates) {
    return mutate(async () => {
      const payload = await save(`/api/thoughts/${item.id}`, "PATCH", updates);
      setItems(current => current.map(row => row.id === item.id ? { ...row, ...payload.thought } : row));
    }, updates.discussed === true ? "Moved to Discussed. You can revisit it there." : updates.discussed === false ? "Moved back to To discuss." : "Changes saved.");
  }

  const openCount = items.filter(item => !item.discussedAt).length;
  const query = search.trim().toLowerCase();
  const visible = items.filter(item => (filter === "discussed") === !!item.discussedAt)
    .filter(item => !query || [item.body, item.notes, item.authorName].some(text => text.toLowerCase().includes(query)))
    .sort((a, b) => new Date(b.discussedAt || b.createdAt).getTime() - new Date(a.discussedAt || a.createdAt).getTime());

  return <section className="thoughts-panel" aria-label="Shared thoughts">
    <form className="thought-composer" onSubmit={add}>
      <label htmlFor="new-thought">What’s on your mind?</label>
      <textarea ref={inputRef} id="new-thought" value={draft} onChange={event => setDraft(event.target.value)} placeholder="An idea, a question, something to bring up…" rows={3} maxLength={3000} required disabled={busy} />
      <div><small>Shared with your team. One thought at a time.</small><button className="button primary" disabled={busy || !loaded || !draft.trim()}><Plus size={16} />Add thought</button></div>
    </form>
    <div className="thought-toolbar">
      <div className="thought-filters" role="group" aria-label="Thought status">
        <button aria-pressed={filter === "open"} onClick={() => setFilter("open")}>To discuss <span>{openCount}</span></button>
        <button aria-pressed={filter === "discussed"} onClick={() => setFilter("discussed")}>Discussed <span>{items.length - openCount}</span></button>
      </div>
      <button className="text-button" disabled={busy} onClick={() => void load()}>Refresh</button>
    </div>
    <p className="thought-hint">{filter === "open" ? "Check a thought after you’ve talked it through." : "Your conversation history. Uncheck anything you want to revisit."}</p>
    {error && <p className="thought-error" role="alert">{error}</p>}
    <p className="thought-feedback" role="status">{busy ? "Saving…" : message}</p>
    {!loaded && !error && <p className="thought-empty"><Loader2 className="spin" size={20} />Loading thoughts…</p>}
    {loaded && !visible.length && <div className="thought-empty">
      {query ? <Search size={24} /> : <Lightbulb size={24} />}
      <strong>{query ? "No matching thoughts" : filter === "open" ? "A little space to think together" : "Nothing discussed yet"}</strong>
      <p>{query ? "Try another search or switch between To discuss and Discussed." : filter === "open" ? "Add an idea or question above. It doesn’t need to be a task." : "Checked thoughts stay here, along with your notes."}</p>
    </div>}
    <ul className="thought-list">
      {visible.map(item => <ThoughtRow key={item.id} item={item} busy={busy} canDelete={isAdmin || currentUserId === item.authorId} onUpdate={updates => update(item, updates)} onDelete={() => mutate(async () => {
        await save(`/api/thoughts/${item.id}`, "DELETE");
        setItems(current => current.filter(row => row.id !== item.id));
      }, "Thought deleted.")} />)}
    </ul>
  </section>;
}

function ThoughtRow({ item, busy, canDelete, onUpdate, onDelete }: { item: Thought; busy: boolean; canDelete: boolean; onUpdate: (updates: Updates) => Promise<boolean>; onDelete: () => Promise<boolean> }) {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState(item.body);
  const [notes, setNotes] = useState(item.notes);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = body !== item.body || notes !== item.notes;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const updates: Updates = {};
    if (body !== item.body) updates.body = body;
    if (notes !== item.notes) updates.notes = notes;
    if (await onUpdate(updates)) { setBody(body.trim()); setNotes(notes.trim()); }
  }
  return <li className={`thought-row ${item.discussedAt ? "is-discussed" : ""}`}>
    <div className="thought-summary">
      <input type="checkbox" checked={!!item.discussedAt} disabled={busy || dirty} onChange={event => void onUpdate({ discussed: event.target.checked })} aria-label={`${item.discussedAt ? "Reopen" : "Mark discussed"}: ${item.body}`} />
      <div className="thought-copy"><p dir="auto">{item.body}</p><small>{item.authorName} · {item.discussedAt ? `Discussed ${dateLabel(item.discussedAt)}` : `Added ${dateLabel(item.createdAt)}`}</small>
        {!expanded && item.notes && <p className="thought-note-preview" dir="auto">{item.notes}</p>}
      </div>
      <button className="thought-details text-button" aria-expanded={expanded} aria-controls={`thought-${item.id}`} onClick={() => setExpanded(!expanded)}>{expanded ? "Close" : "Notes & edit"}<ChevronDown size={14} /></button>
    </div>
    {expanded && <form id={`thought-${item.id}`} className="thought-editor form-stack" onSubmit={submit}>
      <label><span>Thought</span><textarea dir="auto" value={body} onChange={event => setBody(event.target.value)} maxLength={3000} required rows={3} disabled={busy} /></label>
      <label><span>Discussion notes <small>(optional)</small></span><textarea dir="auto" value={notes} onChange={event => setNotes(event.target.value)} placeholder="What did you talk about or agree on?" maxLength={5000} rows={3} disabled={busy} /></label>
      <div className="thought-editor-actions">
        <button className="button secondary" disabled={busy || !dirty || !body.trim()}>Save changes</button>
        {dirty && <button type="button" className="text-button" disabled={busy} onClick={() => { setBody(item.body); setNotes(item.notes); }}>Discard changes</button>}
        {canDelete && <button type="button" className="text-button thought-delete" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete</button>}
      </div>
      {dirty && <small className="thought-hint">Save or discard your edits before checking this thought.</small>}
      {confirmDelete && <div className="thought-delete-confirm"><span>Delete this thought and its notes?</span><button type="button" className="button secondary" disabled={busy} onClick={() => void onDelete()}>Delete thought</button><button type="button" className="text-button" disabled={busy} onClick={() => setConfirmDelete(false)}>Keep it</button></div>}
    </form>}
  </li>;
}
