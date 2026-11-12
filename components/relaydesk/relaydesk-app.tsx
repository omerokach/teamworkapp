"use client";

import Invitations from "./invitations";

import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Copy,
  Flag,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type View = "dashboard" | "my_tasks" | "decisions" | "team";
type TaskStatus = "backlog" | "in_progress" | "review" | "done";
type Priority = "low" | "medium" | "high";

type SessionUser = { id: string; email: string; displayName: string };
type Member = SessionUser & { createdAt: string; lastSeenAt: string };
type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  creatorId: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};
type Comment = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
};
type Decision = {
  id: string;
  title: string;
  summary: string;
  ownerId: string;
  createdAt: string;
};
type ActivityItem = {
  id: string;
  actorId: string;
  kind: string;
  entityId: string | null;
  text: string;
  createdAt: string;
};
type AppData = {
  currentUserId: string;
  members: Member[];
  tasks: Task[];
  comments: Comment[];
  decisions: Decision[];
  activities: ActivityItem[];
};

const columns: Array<{
  status: TaskStatus;
  label: string;
  icon: typeof Inbox;
  tone: string;
}> = [
  { status: "backlog", label: "To do", icon: Inbox, tone: "slate" },
  { status: "in_progress", label: "In progress", icon: CircleDot, tone: "blue" },
  { status: "review", label: "Review", icon: Sparkles, tone: "amber" },
  { status: "done", label: "Done", icon: CheckCircle2, tone: "green" },
];

const navItems: Array<{ id: View; label: string; icon: typeof Inbox }> = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "my_tasks", label: "My tasks", icon: ListChecks },
  { id: "decisions", label: "Decisions", icon: ClipboardList },
  { id: "team", label: "Team", icon: UsersRound },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function avatarTone(id: string) {
  let value = 0;
  for (const character of id) value += character.charCodeAt(0);
  return `avatar-tone-${(value % 5) + 1}`;
}

function parseDate(value: string) {
  if (value.length === 10) return new Date(`${value}T12:00:00`);
  if (value.includes(" ") && !value.endsWith("Z")) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }
  return new Date(value);
}

function formatDate(value: string | null, short = false) {
  if (!value) return "No due date";
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: short ? "short" : "long",
    day: "numeric",
    ...(short ? {} : { year: "numeric" }),
  }).format(date);
}

function timeAgo(value: string) {
  const difference = Date.now() - parseDate(value).getTime();
  const minutes = Math.max(0, Math.floor(difference / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function displayFirstName(name: string) {
  const first = name.trim().split(/\s+/)[0];
  return first.includes("@") ? first.split("@")[0] : first;
}

export default function RelayDeskApp({ sessionUser, isAdmin, onSignOut }: { sessionUser: SessionUser; isAdmin: boolean; onSignOut: () => void }) {
  const [data, setData] = useState<AppData | null>(null);
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    const response = await fetch("/api/state", {
      cache: "no-store",
    });
    const payload = (await response.json()) as AppData & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not load the workspace.");
    setData(payload);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh(true).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Could not load the workspace.");
      setLoading(false);
    });
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const membersById = useMemo(
    () => new Map((data?.members ?? []).map((member) => [member.id, member])),
    [data?.members],
  );
  const selectedTask = data?.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const currentMember = membersById.get(data?.currentUserId ?? sessionUser.id);

  const filteredTasks = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    let tasks = data?.tasks ?? [];
    if (activeView === "my_tasks") {
      tasks = tasks.filter((task) => task.assigneeId === data?.currentUserId);
    }
    if (!normalized) return tasks;
    return tasks.filter((task) => {
      const assignee = task.assigneeId ? membersById.get(task.assigneeId) : null;
      return [task.title, task.description, assignee?.displayName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
  }, [activeView, data?.currentUserId, data?.tasks, membersById, search]);

  const metrics = useMemo(() => {
    const tasks = data?.tasks ?? [];
    const open = tasks.filter((task) => task.status !== "done").length;
    const inProgress = tasks.filter((task) => task.status === "in_progress").length;
    const dueSoon = tasks.filter((task) => {
      if (!task.dueDate || task.status === "done") return false;
      const delta = new Date(`${task.dueDate}T23:59:59`).getTime() - Date.now();
      return delta >= 0 && delta <= 3 * 24 * 60 * 60 * 1000;
    }).length;
    const done = tasks.filter((task) => task.status === "done").length;
    return {
      open,
      inProgress,
      dueSoon,
      completion: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    };
  }, [data?.tasks]);

  async function requestJson(url: string, init: RequestInit, successMessage: string) {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "That change could not be saved.");
    await refresh();
    setToast(successMessage);
    return payload;
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy("create-task");
    try {
      await requestJson(
        "/api/tasks",
        {
          method: "POST",
          body: JSON.stringify({
            title: values.get("title"),
            description: values.get("description"),
            status: values.get("status"),
            priority: values.get("priority"),
            assigneeId: values.get("assigneeId") || null,
            dueDate: values.get("dueDate") || null,
          }),
        },
        "Task added to the board",
      );
      form.reset();
      setShowTaskModal(false);
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Could not add the task.");
    } finally {
      setBusy(null);
    }
  }

  async function updateTask(taskId: string, updates: Partial<Task>) {
    setBusy(`task-${taskId}`);
    try {
      await requestJson(
        `/api/tasks/${taskId}`,
        { method: "PATCH", body: JSON.stringify(updates) },
        "Task updated",
      );
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Could not update the task.");
    } finally {
      setBusy(null);
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(`comment-${selectedTask.id}`);
    try {
      await requestJson(
        `/api/tasks/${selectedTask.id}/comments`,
        { method: "POST", body: JSON.stringify({ body: values.get("body") }) },
        "Comment posted",
      );
      form.reset();
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Could not post the comment.");
    } finally {
      setBusy(null);
    }
  }

  async function createDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy("create-decision");
    try {
      await requestJson(
        "/api/decisions",
        {
          method: "POST",
          body: JSON.stringify({
            title: values.get("title"),
            summary: values.get("summary"),
          }),
        },
        "Decision recorded",
      );
      form.reset();
      setShowDecisionModal(false);
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Could not record the decision.");
    } finally {
      setBusy(null);
    }
  }

  async function copyWorkspaceLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setToast("Workspace link copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setToast("Copy the address from your browser bar.");
    }
  }

  if (loading) return <LoadingScreen />;
  if (error || !data) {
    return (
      <div className="error-screen">
        <div className="brand-mark large" aria-hidden="true"><span /><span /></div>
        <p className="eyebrow">RelayDesk</p>
        <h1>We couldn’t open the workspace.</h1>
        <p>{error || "The workspace is temporarily unavailable."}</p>
        <button className="button primary" onClick={() => refresh(true)}>Try again</button>
        <button className="button ghost" onClick={onSignOut}>Sign in again</button>
      </div>
    );
  }

  const viewLabel = navItems.find((item) => item.id === activeView)?.label ?? "Overview";
  const firstName = displayFirstName(currentMember?.displayName ?? sessionUser.displayName);

  return (
    <div className="relay-app">
      <aside className="sidebar">
        <button className="wordmark" onClick={() => setActiveView("dashboard")}>
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          <span>RelayDesk</span>
        </button>

        <div className="workspace-switcher">
          <span className="workspace-avatar">W</span>
          <span><small>Workspace</small><strong>My team</strong></span>
          <ChevronRight size={15} aria-hidden="true" />
        </div>

        <nav aria-label="Primary navigation">
          <p className="nav-label">Work</p>
          {navItems.slice(0, 3).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activeView === item.id ? "active" : ""}`}
                onClick={() => setActiveView(item.id)}
                aria-current={activeView === item.id ? "page" : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                {item.id === "my_tasks" && (
                  <em>{data.tasks.filter((task) => task.assigneeId === data.currentUserId && task.status !== "done").length}</em>
                )}
              </button>
            );
          })}
          <p className="nav-label people-label">People</p>
          {navItems.slice(3).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activeView === item.id ? "active" : ""}`}
                onClick={() => setActiveView(item.id)}
                aria-current={activeView === item.id ? "page" : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                <em>{data.members.length}</em>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-tip">
          <span className="tip-icon"><Sparkles size={15} /></span>
          <strong>Keep work in context</strong>
          <p>Open a task to discuss it without losing the thread.</p>
        </div>

        <div className="profile-row">
          <Avatar member={currentMember ?? sessionUser} size="medium" />
          <span><strong>{currentMember?.displayName ?? sessionUser.displayName}</strong><small>Online</small></span>
          <button className="text-button signout-button" onClick={onSignOut}>Sign out</button>
        </div>
      </aside>

      <section className="app-body">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark" aria-hidden="true"><span /><span /></span>
            <strong>RelayDesk</strong>
          </div>
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks and people…"
              aria-label="Search tasks and people"
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={onSignOut} aria-label="Sign out"><LogOut size={18} /></button>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} /><span className="notification-dot" />
            </button>
            <button className="button primary" onClick={() => setShowTaskModal(true)}>
              <Plus size={17} aria-hidden="true" />New task
            </button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActiveView(item.id)} className={activeView === item.id ? "active" : ""}>
                <Icon size={18} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={`workspace-content ${activeView === "dashboard" ? "with-activity" : ""}`}>
          <main className="main-content">
            <div className="page-heading">
              <div>
                <p className="eyebrow">{viewLabel}</p>
                <h1>
                  {activeView === "dashboard" && `Welcome back, ${firstName}`}
                  {activeView === "my_tasks" && "Your work, one clear list"}
                  {activeView === "decisions" && "Decisions your team can find"}
                  {activeView === "team" && "The people moving work forward"}
                </h1>
                <p>
                  {activeView === "dashboard" && "Here’s what needs attention across the team."}
                  {activeView === "my_tasks" && "Everything assigned to you, without the chat scroll."}
                  {activeView === "decisions" && "Record the why once, then keep everyone aligned."}
                  {activeView === "team" && "Your invited partners, connected to one shared workspace."}
                </p>
              </div>
              {activeView === "decisions" && (
                <button className="button secondary" onClick={() => setShowDecisionModal(true)}>
                  <Plus size={17} />Record decision
                </button>
              )}
              {activeView === "team" && (
                <button className="button secondary" onClick={copyWorkspaceLink}>
                  {copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "Copied" : "Copy app link"}
                </button>
              )}
            </div>

            {activeView === "dashboard" && (
              <>
                <section className="metrics-grid" aria-label="Workspace summary">
                  <MetricCard label="Open tasks" value={metrics.open} detail={`${metrics.inProgress} moving now`} icon={ClipboardList} tone="ink" />
                  <MetricCard label="In progress" value={metrics.inProgress} detail="Across the whole team" icon={Activity} tone="blue" />
                  <MetricCard label="Due soon" value={metrics.dueSoon} detail="Within the next 3 days" icon={CalendarDays} tone="coral" />
                  <MetricCard label="Completed" value={`${metrics.completion}%`} detail="Of all captured work" icon={CheckCircle2} tone="green" />
                </section>
                <section className="board-section">
                  <div className="section-heading">
                    <div><h2>Team board</h2><p>Every task has an owner, a status, and its conversation.</p></div>
                    <button className="text-button" onClick={() => setActiveView("my_tasks")}>View my tasks <ArrowRight size={15} /></button>
                  </div>
                  <TaskBoard tasks={filteredTasks} comments={data.comments} membersById={membersById} onSelect={setSelectedTaskId} onNew={() => setShowTaskModal(true)} />
                </section>
              </>
            )}

            {activeView === "my_tasks" && (
              <section className="board-section standalone">
                <div className="section-heading compact">
                  <div><h2>{filteredTasks.length} assigned tasks</h2><p>Focus on active work first; completed items stay visible for context.</p></div>
                  <button className="button secondary" onClick={() => setShowTaskModal(true)}><Plus size={17} />Add task</button>
                </div>
                <TaskBoard tasks={filteredTasks} comments={data.comments} membersById={membersById} onSelect={setSelectedTaskId} onNew={() => setShowTaskModal(true)} />
              </section>
            )}

            {activeView === "decisions" && (
              <DecisionList decisions={data.decisions} membersById={membersById} onNew={() => setShowDecisionModal(true)} />
            )}
            {activeView === "team" && (
              <><TeamView members={data.members} currentUserId={data.currentUserId} onCopy={copyWorkspaceLink} />{isAdmin && <Invitations />}</>
            )}
          </main>

          {activeView === "dashboard" && (
            <aside className="activity-panel">
              <div className="activity-heading">
                <div><p className="eyebrow">Live workspace</p><h2>Recent activity</h2></div>
                <span className="live-pill"><i />Live</span>
              </div>
              <div className="activity-list">
                {data.activities.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    className="activity-item"
                    onClick={() => {
                      if (item.entityId && data.tasks.some((task) => task.id === item.entityId)) setSelectedTaskId(item.entityId);
                    }}
                  >
                    <Avatar member={membersById.get(item.actorId)} size="small" />
                    <span><strong>{membersById.get(item.actorId)?.displayName ?? "A teammate"}</strong>{" "}{item.text}<small>{timeAgo(item.createdAt)}</small></span>
                  </button>
                ))}
              </div>
              <div className="focus-card">
                <span className="focus-icon"><Sparkles size={17} /></span>
                <p className="eyebrow">A better team habit</p>
                <h3>Turn messages into owned work.</h3>
                <p>If it needs action, make it a task. If it changes direction, record a decision.</p>
                <button onClick={() => setShowTaskModal(true)}>Capture something <ArrowRight size={15} /></button>
              </div>
            </aside>
          )}
        </div>
      </section>

      {showTaskModal && (
        <Modal title="Create a task" subtitle="Give the work enough context to move without another message." onClose={() => setShowTaskModal(false)}>
          <form className="form-stack" onSubmit={createTask}>
            <label><span>Task title</span><input name="title" placeholder="What needs to happen?" maxLength={140} autoFocus required /></label>
            <label><span>Description</span><textarea name="description" rows={4} placeholder="Add the background, expected outcome, or useful links…" /></label>
            <div className="form-grid two">
              <label><span>Owner</span><select name="assigneeId" defaultValue={data.currentUserId}><option value="">Unassigned</option>{data.members.map((member) => <option value={member.id} key={member.id}>{member.displayName}</option>)}</select></label>
              <label><span>Due date</span><input type="date" name="dueDate" /></label>
              <label><span>Priority</span><select name="priority" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
              <label><span>Status</span><select name="status" defaultValue="backlog">{columns.map((column) => <option value={column.status} key={column.status}>{column.label}</option>)}</select></label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={() => setShowTaskModal(false)}>Cancel</button>
              <button className="button primary" disabled={busy === "create-task"}>{busy === "create-task" ? <Loader2 className="spin" size={17} /> : <Plus size={17} />}Add task</button>
            </div>
          </form>
        </Modal>
      )}

      {showDecisionModal && (
        <Modal title="Record a decision" subtitle="Capture what changed and why, so the team can move forward." onClose={() => setShowDecisionModal(false)}>
          <form className="form-stack" onSubmit={createDecision}>
            <label><span>Decision</span><input name="title" placeholder="What did the team decide?" maxLength={140} autoFocus required /></label>
            <label><span>Reason and impact</span><textarea name="summary" rows={6} placeholder="Explain the context, the reason, and what this changes…" required /></label>
            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={() => setShowDecisionModal(false)}>Cancel</button>
              <button className="button primary" disabled={busy === "create-decision"}>{busy === "create-decision" ? <Loader2 className="spin" size={17} /> : <Check size={17} />}Record decision</button>
            </div>
          </form>
        </Modal>
      )}

      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          members={data.members}
          membersById={membersById}
          currentUserId={data.currentUserId}
          comments={data.comments.filter((comment) => comment.taskId === selectedTask.id)}
          busy={busy === `task-${selectedTask.id}` || busy === `comment-${selectedTask.id}`}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={(updates) => updateTask(selectedTask.id, updates)}
          onComment={addComment}
        />
      )}

      {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  );
}

function Avatar({ member, size = "small" }: { member?: Pick<Member, "id" | "displayName"> | SessionUser; size?: "small" | "medium" | "large" }) {
  const name = member?.displayName ?? "Teammate";
  return <span className={`avatar ${size} ${avatarTone(member?.id ?? name)}`} title={name}>{initials(name)}</span>;
}

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string | number; detail: string; icon: typeof Inbox; tone: string }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={18} /></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function TaskBoard({ tasks, comments, membersById, onSelect, onNew }: { tasks: Task[]; comments: Comment[]; membersById: Map<string, Member>; onSelect: (id: string) => void; onNew: () => void }) {
  return (
    <div className="board-scroll"><div className="kanban-board">
      {columns.map((column) => {
        const Icon = column.icon;
        const columnTasks = tasks.filter((task) => task.status === column.status);
        return (
          <section className="kanban-column" key={column.status}>
            <header><span className={`column-icon ${column.tone}`}><Icon size={15} /></span><h3>{column.label}</h3><em>{columnTasks.length}</em><button onClick={onNew} aria-label={`Add task to ${column.label}`}><Plus size={16} /></button></header>
            <div className="column-cards">
              {columnTasks.map((task) => {
                const assignee = task.assigneeId ? membersById.get(task.assigneeId) : undefined;
                const commentCount = comments.filter((comment) => comment.taskId === task.id).length;
                return (
                  <button className="task-card" key={task.id} onClick={() => onSelect(task.id)}>
                    <div className="task-card-top"><span className={`priority ${task.priority}`}><i />{task.priority}</span><MoreHorizontal size={17} aria-hidden="true" /></div>
                    <h4>{task.title}</h4>
                    {task.description && <p>{task.description}</p>}
                    <div className="task-meta"><span className={task.dueDate ? "" : "muted"}><CalendarDays size={14} />{task.dueDate ? formatDate(task.dueDate, true) : "No date"}</span>{commentCount > 0 && <span><MessageCircle size={14} />{commentCount}</span>}<Avatar member={assignee} size="small" /></div>
                  </button>
                );
              })}
              {columnTasks.length === 0 && <button className="empty-column" onClick={onNew}><Plus size={16} />Add a task</button>}
            </div>
          </section>
        );
      })}
    </div></div>
  );
}

function DecisionList({ decisions, membersById, onNew }: { decisions: Decision[]; membersById: Map<string, Member>; onNew: () => void }) {
  if (!decisions.length) {
    return <section className="empty-state large"><span className="empty-icon"><ClipboardList size={25} /></span><p className="eyebrow">Nothing lost in chat</p><h2>Record your first team decision</h2><p>Capture the choice, the reason, and the owner. The next person won’t have to ask “why did we do this?”</p><button className="button primary" onClick={onNew}><Plus size={17} />Record decision</button></section>;
  }
  return (
    <section className="decision-list">
      {decisions.map((decision, index) => {
        const owner = membersById.get(decision.ownerId);
        return <article className="decision-card" key={decision.id}><div className="decision-number">{String(decisions.length - index).padStart(2, "0")}</div><div className="decision-content"><div className="decision-meta"><span className="decision-status"><Check size={13} />Decided</span><time>{formatDate(decision.createdAt)}</time></div><h2>{decision.title}</h2><p>{decision.summary}</p><div className="decision-owner"><Avatar member={owner} size="small" /><span>Recorded by <strong>{owner?.displayName ?? "A teammate"}</strong></span></div></div></article>;
      })}
    </section>
  );
}

function TeamView({ members, currentUserId, onCopy }: { members: Member[]; currentUserId: string; onCopy: () => void }) {
  return (
    <section>
      <div className="invite-banner"><div className="invite-visual"><UsersRound size={25} /><span><Plus size={13} /></span></div><div><p className="eyebrow">One shared team</p><h2>Your team, always in sync</h2><p>Access is by email invitation from the workspace owner. Your account and assigned tasks follow you across devices.</p></div><button className="button light" onClick={onCopy}><Copy size={17} />Copy app link</button></div>
      <div className="team-grid">
        {members.map((member) => <article className="member-card" key={member.id}><Avatar member={member} size="large" /><div><h3>{member.displayName}{member.id === currentUserId && <span>You</span>}</h3><p>{member.email.endsWith("@relaydesk.local") ? "Guest member" : member.email}</p></div><span className="online-status"><i />Active</span></article>)}
      </div>
    </section>
  );
}

function TaskDrawer({ task, members, membersById, currentUserId, comments, busy, onClose, onUpdate, onComment }: { task: Task; members: Member[]; membersById: Map<string, Member>; currentUserId: string; comments: Comment[]; busy: boolean; onClose: () => void; onUpdate: (updates: Partial<Task>) => void; onComment: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={task.title}>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close task details" />
      <aside className="task-drawer">
        <header className="drawer-header"><span className={`priority ${task.priority}`}><i />{task.priority} priority</span><button className="icon-button plain" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
        <div className="drawer-scroll">
          <h2>{task.title}</h2><p className="task-description">{task.description || "No description yet."}</p>
          <div className="task-properties">
            <label><span><CircleDot size={15} />Status</span><select value={task.status} onChange={(event) => onUpdate({ status: event.target.value as TaskStatus })} disabled={busy}>{columns.map((column) => <option key={column.status} value={column.status}>{column.label}</option>)}</select></label>
            <label><span><UsersRound size={15} />Owner</span><select value={task.assigneeId ?? ""} onChange={(event) => onUpdate({ assigneeId: event.target.value || null })} disabled={busy}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></label>
            <div><span><CalendarDays size={15} />Due date</span><strong>{formatDate(task.dueDate)}</strong></div>
            <div><span><Flag size={15} />Priority</span><strong className="capitalize">{task.priority}</strong></div>
          </div>
          <section className="conversation"><div className="conversation-heading"><div><h3>Conversation</h3><p>Keep discussion attached to the task.</p></div><span>{comments.length}</span></div><div className="comment-list">
            {comments.map((comment) => { const author = membersById.get(comment.authorId); return <article className="comment" key={comment.id}><Avatar member={author} size="small" /><div><header><strong>{author?.displayName ?? "Teammate"}</strong><time>{timeAgo(comment.createdAt)}</time></header><p>{comment.body}</p></div></article>; })}
            {!comments.length && <div className="empty-comments"><MessageCircle size={20} /><p>No comments yet. Add the context your team needs.</p></div>}
          </div></section>
        </div>
        <form className="comment-composer" onSubmit={onComment}><Avatar member={membersById.get(currentUserId)} size="small" /><input name="body" placeholder="Write a comment…" autoComplete="off" required /><button disabled={busy} aria-label="Post comment">{busy ? <Loader2 className="spin" size={17} /> : <Send size={17} />}</button></form>
      </aside>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}><button className="modal-backdrop" onClick={onClose} aria-label="Close dialog" /><div className="modal-card"><header><div><p className="eyebrow">RelayDesk</p><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button plain" onClick={onClose} aria-label="Close"><X size={20} /></button></header>{children}</div></div>;
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="brand-mark large" aria-hidden="true"><span /><span /></div><h1>RelayDesk</h1><p>Preparing your team workspace…</p><div className="loading-line"><span /></div></div>;
}
