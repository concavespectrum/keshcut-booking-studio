import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { requestAdminOtp } from "@/lib/admin/admin.functions";
import { normalizePhone } from "@/lib/kc-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin | KeshCut Studio" },
      { name: "description", content: "Private management dashboard for KeshCut Studio bookings, customers and messages." },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Admin | KeshCut Studio" },
      { property: "og:description", content: "Private management dashboard for KeshCut Studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;
type Status = (typeof STATUSES)[number];
const LABEL: Record<string, string> = { pending: "Pending", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
const fmt = (s: string) =>
  new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "USER_UPDATED") setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) return setIsAdmin(null);
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(!!data));
  }, [session?.user.id]);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <Toaster />
      {!session ? (
        <Login />
      ) : isAdmin === null ? (
        <p className="p-8 text-muted-foreground">Checking access…</p>
      ) : !isAdmin ? (
        <div className="mx-auto max-w-md p-8 text-center">
          <h1 className="text-2xl font-semibold">Not authorized</h1>
          <p className="mt-2 text-muted-foreground">This account does not have admin access.</p>
          <Button className="mt-6" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      ) : (
        <Dashboard email={session.user.email ?? ""} />
      )}
    </div>
  );
}

function Login() {
  const send = useServerFn(requestAdminOtp);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (step === 1) {
        await send({ data: { email, phone } });
        setStep(2);
      } else {
        const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
        if (error) throw new Error("That code is wrong or has expired.");
      }
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mx-auto mt-24 max-w-sm space-y-4 border border-border p-8">
      <h1 className="font-serif text-3xl">KeshCut Studio admin</h1>
      {step === 1 ? (
        <>
          <Input type="email" placeholder="Authorized Gmail address" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="tel" placeholder="Authorized phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">We sent a sign-in code to {email}. Enter it below, or open the link in that email.</p>
          <Input inputMode="numeric" placeholder="Code from email" value={code} onChange={(e) => setCode(e.target.value)} required />
        </>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button className="w-full" disabled={busy}>{step === 1 ? "Send code" : "Sign in"}</Button>
      {step === 2 && (
        <button type="button" className="text-sm underline" onClick={() => setStep(1)}>Start again</button>
      )}
    </form>
  );
}

type BookingRow = {
  id: string; ticket_id: string; starts_at: string; ends_at: string; status: string; total_price_npr: number | null;
  admin_note: string | null; created_at: string; updated_at: string;
  customers: { id: string; name: string; phone: string; visit_count: number } | null;
  booking_services: { name: string }[];
};
const BOOKING_COLS = "id,ticket_id,starts_at,ends_at,status,total_price_npr,admin_note,created_at,updated_at,customers!inner(id,name,phone,visit_count),booking_services(name)";

// One realtime channel for the whole dashboard; listeners debounce refetches.
function useLive(onChange: (table: string, row: Record<string, unknown>) => void) {
  const ref = useRef(onChange);
  ref.current = onChange;
  useEffect(() => {
    const ch = supabase.channel(`admin-${Math.random().toString(36).slice(2)}`);
    for (const t of ["bookings", "booking_services", "messages", "conversations"])
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, (p) => ref.current(t, (p.new ?? p.old) as Record<string, unknown>));
    ch.subscribe();
    return () => void supabase.removeChannel(ch);
  }, []);
}
function useDebounced(fn: () => void, ms = 400) {
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const f = useRef(fn);
  f.current = fn;
  return useCallback(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => f.current(), ms);
  }, [ms]);
}

function Dashboard({ email }: { email: string }) {
  const [tab, setTab] = useState("bookings");
  const [openConv, setOpenConv] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const bump = useRef({ bookings: 0, conv: 0, cust: 0 });
  const [tick, setTick] = useState({ bookings: 0, conv: 0, cust: 0 });
  const flush = useDebounced(() => setTick({ ...bump.current }));
  useLive((t, row) => {
    if (t === "bookings" || t === "booking_services") bump.current.bookings++;
    if (t === "messages" || t === "conversations") bump.current.conv++;
    bump.current.cust++;
    const r = row as { status?: string; ticket_id?: string; created_at?: string; updated_at?: string };
    if (t === "bookings" && r.status === "pending" && r.created_at === r.updated_at) toast("New booking received", { description: r.ticket_id ?? "" });
    flush();
  });
  const loadUnread = useCallback(async () => {
    const { data } = await supabase.from("conversations").select("unread_admin").gt("unread_admin", 0).limit(500);
    setUnread((data ?? []).reduce((s, r) => s + r.unread_admin, 0));
  }, []);
  useEffect(() => void loadUnread(), [tick.conv, loadUnread]);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">KeshCut Studio · Management</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{email}</span>
          <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="messages">Messages{unread > 0 && <Badge className="ml-2">{unread}</Badge>}</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings"><Bookings tick={tick.bookings} /></TabsContent>
        <TabsContent value="messages"><Messages tick={tick.conv} open={openConv} setOpen={setOpenConv} /></TabsContent>
        <TabsContent value="customers">
          <Customers tick={tick.cust} onChat={(id) => { setOpenConv(id); setTab("messages"); }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  return <Badge variant={s === "confirmed" ? "default" : s === "pending" ? "secondary" : "outline"}>{LABEL[s] ?? s}</Badge>;
}

function Bookings({ tick }: { tick: number }) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"upcoming" | "pending" | "past">("upcoming");
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [sel, setSel] = useState<BookingRow | null>(null);
  const load = useCallback(async () => {
    let qb = supabase.from("bookings").select(BOOKING_COLS).limit(200);
    const s = q.trim();
    const now = new Date().toISOString();
    if (s) {
      const ph = s.replace(/\D/g, "");
      if (/^kc-?/i.test(s)) qb = qb.ilike("ticket_id", `%${s.toUpperCase().replace(/^KC-?/, "KC-")}%`);
      else if (ph.length >= 3) qb = qb.ilike("customers.phone", `%${normalizePhone(s) ?? ph.replace(/^977/, "")}%`);
      else qb = qb.ilike("customers.name", `%${s.replace(/[%_,()]/g, "")}%`);
      qb = qb.order("starts_at", { ascending: false });
    } else if (view === "pending") qb = qb.eq("status", "pending").order("starts_at");
    else if (view === "upcoming") qb = qb.gte("ends_at", now).in("status", ["pending", "confirmed"]).order("starts_at");
    else qb = qb.lt("starts_at", now).order("starts_at", { ascending: false });
    const { data, error } = await qb;
    if (error) toast.error(error.message);
    const list = (data ?? []) as unknown as BookingRow[];
    setRows(list);
    setSel((cur) => (cur ? list.find((r) => r.id === cur.id) ?? cur : null));
  }, [q, view]);
  const deb = useDebounced(load, 300);
  useEffect(() => deb(), [q, deb]);
  useEffect(() => void load(), [view, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (b: BookingRow, status: Status) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", b.id);
    if (error) toast.error(error.message.includes("no_overlap") ? "That time now overlaps another booking." : error.message);
    else load();
  };
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Search name, phone or ticket ID" value={q} onChange={(e) => setQ(e.target.value)} />
          {(["upcoming", "pending", "past"] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v && !q ? "default" : "outline"} onClick={() => { setQ(""); setView(v); }}>
              {v === "upcoming" ? "Upcoming" : v === "pending" ? "Needs confirming" : "Past"}
            </Button>
          ))}
        </div>
        <div className="divide-y divide-border border border-border">
          {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No bookings found.</p>}
          {rows.map((b) => (
            <button key={b.id} onClick={() => setSel(b)} className={`flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left hover:bg-accent ${sel?.id === b.id ? "bg-accent" : ""}`}>
              <div>
                <div className="font-mono text-sm font-semibold">{b.ticket_id}</div>
                <div className="text-sm">{b.customers?.name} · {b.customers?.phone}</div>
                <div className="text-xs text-muted-foreground">{b.booking_services.map((s) => s.name).join(", ")}</div>
              </div>
              <div className="text-right">
                <div className="text-sm">{fmt(b.starts_at)}</div>
                <StatusBadge s={b.status} />
              </div>
            </button>
          ))}
        </div>
      </div>
      {sel && (
        <aside className="h-fit space-y-3 border border-border p-4">
          <div className="text-xs uppercase text-muted-foreground">Ticket ID</div>
          <div className="font-mono text-2xl font-semibold">{sel.ticket_id}</div>
          <StatusBadge s={sel.status} />
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted-foreground">Customer: </dt><dd className="inline">{sel.customers?.name}</dd></div>
            <div><dt className="inline text-muted-foreground">Phone: </dt><dd className="inline">{sel.customers?.phone}</dd></div>
            <div><dt className="inline text-muted-foreground">Visits: </dt><dd className="inline">{sel.customers?.visit_count}</dd></div>
            <div><dt className="inline text-muted-foreground">Time: </dt><dd className="inline">{fmt(sel.starts_at)} – {new Date(sel.ends_at).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit" })}</dd></div>
            <div><dt className="inline text-muted-foreground">Services: </dt><dd className="inline">{sel.booking_services.map((s) => s.name).join(", ")}</dd></div>
            <div><dt className="inline text-muted-foreground">Price: </dt><dd className="inline">{sel.total_price_npr != null ? `Rs ${sel.total_price_npr}` : "Set at studio"}</dd></div>
            <div><dt className="inline text-muted-foreground">Booked: </dt><dd className="inline">{fmt(sel.created_at)}</dd></div>
            <div><dt className="inline text-muted-foreground">Last change: </dt><dd className="inline">{fmt(sel.updated_at)}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {STATUSES.filter((s) => s !== sel.status).map((s) => (
              <Button key={s} size="sm" variant={s === "confirmed" ? "default" : "outline"} onClick={() => setStatus(sel, s)}>{LABEL[s]}</Button>
            ))}
          </div>
          <NoteEditor b={sel} onSaved={load} />
        </aside>
      )}
    </div>
  );
}

function NoteEditor({ b, onSaved }: { b: BookingRow; onSaved: () => void }) {
  const [v, setV] = useState(b.admin_note ?? "");
  useEffect(() => setV(b.admin_note ?? ""), [b.id, b.admin_note]);
  return (
    <div className="space-y-2">
      <Textarea placeholder="Private note (only admins see this)" value={v} maxLength={1000} onChange={(e) => setV(e.target.value)} />
      <Button size="sm" variant="outline" onClick={async () => {
        const { error } = await supabase.from("bookings").update({ admin_note: v.slice(0, 1000) }).eq("id", b.id);
        if (error) toast.error(error.message); else { toast("Note saved"); onSaved(); }
      }}>Save note</Button>
    </div>
  );
}

type Conv = { id: string; last_message_at: string; unread_admin: number; customers: { name: string; phone: string } | null };
type Msg = { id: number; sender: string; body: string; created_at: string };

function Messages({ tick, open, setOpen }: { tick: number; open: string | null; setOpen: (id: string) => void }) {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    supabase.from("conversations").select("id,last_message_at,unread_admin,customers(name,phone)").order("last_message_at", { ascending: false }).limit(100)
      .then(({ data }) => setConvs((data ?? []) as unknown as Conv[]));
  }, [tick]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase(), d = s.replace(/\D/g, "");
    return !s ? convs : convs.filter((c) => c.customers?.name.toLowerCase().includes(s) || (d && c.customers?.phone.includes(d)));
  }, [q, convs]);
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[300px_1fr]">
      <div>
        <Input className="mb-2" placeholder="Filter by name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="divide-y divide-border border border-border">
          {shown.length === 0 && <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>}
          {shown.map((c) => (
            <button key={c.id} onClick={() => setOpen(c.id)} className={`flex w-full items-center justify-between p-3 text-left hover:bg-accent ${open === c.id ? "bg-accent" : ""}`}>
              <div><div className="text-sm font-medium">{c.customers?.name}</div><div className="text-xs text-muted-foreground">{c.customers?.phone} · {fmt(c.last_message_at)}</div></div>
              {c.unread_admin > 0 && <Badge>{c.unread_admin}</Badge>}
            </button>
          ))}
        </div>
      </div>
      {open ? <Thread id={open} tick={tick} /> : <p className="text-sm text-muted-foreground">Choose a conversation.</p>}
    </div>
  );
}

function Thread({ id, tick }: { id: string; tick: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const last = msgs.at(-1)?.id ?? 0;
  useEffect(() => setMsgs([]), [id]);
  useEffect(() => {
    // Incremental fetch: only rows newer than the last one we have.
    supabase.from("messages").select("id,sender,body,created_at").eq("conversation_id", id).gt("id", last).order("id", { ascending: false }).limit(200)
      .then(({ data }) => {
        if (data?.length) setMsgs((m) => [...m, ...data.filter((x) => !m.some((y) => y.id === x.id))].sort((a, b) => a.id - b.id));
      });
    supabase.from("conversations").update({ unread_admin: 0 }).eq("id", id).gt("unread_admin", 0).then(() => {});
  }, [id, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [msgs.length]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender: "admin", body: body.slice(0, 1000) });
    if (error) toast.error(error.message); else setText("");
  };
  return (
    <div className="flex h-[70vh] flex-col border border-border">
      <div ref={box} className="flex-1 space-y-2 overflow-auto p-4">
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[80%] whitespace-pre-wrap break-words rounded-sm border border-border px-3 py-2 text-sm ${m.sender === "admin" ? "ml-auto bg-primary text-primary-foreground" : ""}`}>
            {m.body}
            <div className="mt-1 text-[10px] opacity-60">{m.sender === "admin" ? "Studio" : "Customer"} · {fmt(m.created_at)}</div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
        <Textarea rows={2} maxLength={1000} value={text} placeholder="Reply (text and emoji only)" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }}
          onPaste={(e) => { if (e.clipboardData.files.length) e.preventDefault(); }} onDrop={(e) => { if (e.dataTransfer.files.length) e.preventDefault(); }} />
        <Button>Send</Button>
      </form>
    </div>
  );
}

type Cust = {
  id: string; name: string; phone: string; visit_count: number; created_at: string;
  bookings: { ticket_id: string; starts_at: string; status: string; total_price_npr: number | null; booking_services: { name: string }[] }[];
  conversations: { id: string; messages: { id: number; sender: string; body: string; created_at: string }[] }[];
};
function Customers({ tick, onChat }: { tick: number; onChat: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Cust[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const load = useCallback(async () => {
    const d = q.replace(/\D/g, "");
    if (d.length < 3) { setRows([]); return; }
    const p = normalizePhone(q) ?? d.replace(/^977/, "");
    const { data } = await supabase.from("customers")
      .select("id,name,phone,visit_count,created_at,bookings(ticket_id,starts_at,status,total_price_npr,booking_services(name)),conversations(id,messages(id,sender,body,created_at))")
      .ilike("phone", `%${p}%`).order("starts_at", { referencedTable: "bookings", ascending: false }).limit(20);
    setRows((data ?? []) as unknown as Cust[]);
  }, [q]);
  const deb = useDebounced(load, 300);
  useEffect(() => deb(), [q, tick, deb]);
  const c = rows.find((r) => r.id === sel) ?? (rows.length === 1 ? rows[0] : null);
  const services = c ? [...new Set(c.bookings.flatMap((b) => b.booking_services.map((s) => s.name)))] : [];
  return (
    <div className="mt-4 space-y-4">
      <Input className="max-w-xs" type="tel" placeholder="Search by phone number" value={q} onChange={(e) => setQ(e.target.value)} />
      {rows.length > 1 && (
        <div className="flex flex-wrap gap-2">{rows.map((r) => <Button key={r.id} size="sm" variant={c?.id === r.id ? "default" : "outline"} onClick={() => setSel(r.id)}>{r.name} · {r.phone}</Button>)}</div>
      )}
      {q.replace(/\D/g, "").length >= 3 && rows.length === 0 && <p className="text-sm text-muted-foreground">No customer with that number.</p>}
      {c && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-2 border border-border p-4">
            <h2 className="font-serif text-2xl">{c.name}</h2>
            <p className="text-sm">{c.phone} · {c.visit_count} completed visit{c.visit_count === 1 ? "" : "s"} · {c.bookings.length} booking{c.bookings.length === 1 ? "" : "s"}</p>
            <p className="text-xs text-muted-foreground">Customer since {fmt(c.created_at)}</p>
            <p className="text-sm"><span className="text-muted-foreground">Services used: </span>{services.join(", ") || "None yet"}</p>
            <div className="divide-y divide-border">
              {c.bookings.map((b) => (
                <div key={b.ticket_id} className="flex justify-between gap-2 py-2 text-sm">
                  <div><span className="font-mono font-semibold">{b.ticket_id}</span> · {fmt(b.starts_at)}<div className="text-xs text-muted-foreground">{b.booking_services.map((s) => s.name).join(", ")}</div></div>
                  <StatusBadge s={b.status} />
                </div>
              ))}
            </div>
          </section>
          <section className="space-y-2 border border-border p-4">
            <h3 className="font-medium">Conversation history</h3>
            {c.conversations.length === 0 && <p className="text-sm text-muted-foreground">No messages.</p>}
            {c.conversations.map((cv) => (
              <div key={cv.id} className="space-y-1">
                <div className="max-h-80 space-y-1 overflow-auto">
                  {[...cv.messages].sort((a, b) => a.id - b.id).slice(-100).map((m) => (
                    <p key={m.id} className="text-sm"><span className="text-muted-foreground">{m.sender === "admin" ? "Studio" : "Customer"} ({fmt(m.created_at)}): </span>{m.body}</p>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => onChat(cv.id)}>Open chat</Button>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
