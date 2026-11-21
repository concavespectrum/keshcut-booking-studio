import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Trash2, Upload } from "lucide-react";
import { compressImage, videoPoster } from "@/lib/admin/media";

const ktmParts = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 345 * 60000).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
};
const TIMES = Array.from({ length: (19 - 9) * 12 }, (_, i) => {
  const m = 540 + i * 5;
  return `${String((m / 60) | 0).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

/** Admin: move a pending/confirmed ticket to a new time (database checks hours and overlaps). */
export function Reschedule({ id, startsAt, status, onDone }: { id: string; startsAt: string; status: string; onDone: () => void }) {
  const p = ktmParts(startsAt);
  const [date, setDate] = useState(p.date);
  const [time, setTime] = useState(p.time);
  useEffect(() => { const q = ktmParts(startsAt); setDate(q.date); setTime(q.time); }, [id, startsAt]);
  if (status !== "pending" && status !== "confirmed") return null;
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="text-xs uppercase text-muted-foreground">Change appointment time</div>
      <div className="flex flex-wrap gap-2">
        <Input type="date" aria-label="New date" className="w-40 text-base" value={date} onChange={(e) => setDate(e.target.value)} />
        <select aria-label="New time" className="h-10 rounded-md border border-input bg-background px-2 text-base" value={time} onChange={(e) => setTime(e.target.value)}>
          {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button size="sm" onClick={async () => {
          const { error } = await supabase.rpc("kc_admin_reschedule", { p_id: id, p_start: `${date}T${time}:00+05:45` });
          if (error) toast.error(error.message.includes("slot_taken") ? "That time overlaps another booking." : error.message.includes("outside_hours") ? "Must start and finish between 9 AM and 7 PM." : error.message);
          else { toast("Time changed"); onDone(); }
        }}>Save time</Button>
      </div>
    </div>
  );
}

type Svc = { id: number; name: string; duration_min: number; price_npr: number | null; bookable: boolean; sort: number };

export function Services() {
  const [rows, setRows] = useState<Svc[]>([]);
  const [nw, setNw] = useState({ name: "", duration: "30", price: "" });
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("services").select("id,name,duration_min,price_npr,bookable,sort").order("sort").order("id");
    if (error) toast.error(error.message); else setRows(data as Svc[]);
  }, []);
  useEffect(() => void load(), [load]);
  const save = async (s: Svc, patch: Partial<Svc>) => {
    const { error } = await supabase.from("services").update(patch).eq("id", s.id);
    if (error) toast.error(error.message); else { toast("Saved"); load(); }
  };
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">Prices show on the website and new bookings. Hidden services stay on old tickets but can't be booked.</p>
      <div className="divide-y divide-border border border-border">
        {rows.filter((s) => s.id !== 12).map((s) => <ServiceRow key={s.id} s={s} onSave={save} />)}
      </div>
      <form className="flex flex-wrap items-end gap-2 border border-border p-3" onSubmit={async (e) => {
        e.preventDefault();
        const name = nw.name.trim(); const d = Number(nw.duration); const pr = nw.price === "" ? null : Number(nw.price);
        if (!name || !(d >= 5 && d <= 480) || (pr != null && !(pr >= 0))) { toast.error("Enter a name, 5–480 minutes and a valid price."); return; }
        const { error } = await supabase.from("services").insert({ name: name.slice(0, 80), duration_min: Math.round(d), price_npr: pr, sort: 50 });
        if (error) toast.error(error.message.includes("unique") ? "A service with that name exists." : error.message);
        else { setNw({ name: "", duration: "30", price: "" }); toast("Service added"); load(); }
      }}>
        <Input className="min-w-48 flex-1 text-base" placeholder="New service name" value={nw.name} maxLength={80} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
        <Input className="w-28 text-base" type="number" min={5} max={480} step={5} aria-label="Minutes" value={nw.duration} onChange={(e) => setNw({ ...nw, duration: e.target.value })} />
        <Input className="w-32 text-base" type="number" min={0} placeholder="Price (Rs)" value={nw.price} onChange={(e) => setNw({ ...nw, price: e.target.value })} />
        <Button>Add service</Button>
      </form>
    </div>
  );
}

function ServiceRow({ s, onSave }: { s: Svc; onSave: (s: Svc, p: Partial<Svc>) => void }) {
  const [name, setName] = useState(s.name);
  const [dur, setDur] = useState(String(s.duration_min));
  const [price, setPrice] = useState(s.price_npr == null ? "" : String(s.price_npr));
  return (
    <div className={`flex flex-wrap items-center gap-2 p-3 ${s.bookable ? "" : "opacity-60"}`}>
      <Input className="min-w-48 flex-1 text-base" aria-label="Service name" value={name} maxLength={80} disabled={s.id === 13} onChange={(e) => setName(e.target.value)} />
      <Input className="w-24 text-base" type="number" min={5} max={480} step={5} aria-label="Minutes" value={dur} onChange={(e) => setDur(e.target.value)} />
      <Input className="w-28 text-base" type="number" min={0} placeholder="Price" aria-label="Price in rupees" value={price} onChange={(e) => setPrice(e.target.value)} />
      <Button size="sm" variant="outline" onClick={() => {
        const d = Number(dur), pr = price === "" ? null : Number(price);
        if (!name.trim() || !(d >= 5 && d <= 480) || (pr != null && !(pr >= 0))) { toast.error("Check name, minutes (5–480) and price."); return; }
        onSave(s, { name: name.trim(), duration_min: Math.round(d), price_npr: pr });
      }}>Save</Button>
      <Button size="sm" variant="ghost" onClick={() => onSave(s, { bookable: !s.bookable })}>{s.bookable ? "Hide" : "Show"}</Button>
    </div>
  );
}

type Media = { id: string; section: "teach" | "studio"; kind: "image" | "video"; path: string; poster: string | null; title: string; sort: number };
const src = (p: string) => (p.startsWith("/") ? p : `/api/public/kc?file=${encodeURIComponent(p)}`);

export function MediaManager() {
  const [rows, setRows] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("site_media").select("id,section,kind,path,poster,title,sort").order("sort").order("created_at");
    if (error) toast.error(error.message); else setRows(data as Media[]);
  }, []);
  useEffect(() => void load(), [load]);

  const removeFiles = async (m: Pick<Media, "path" | "poster">) => {
    const files = [m.path, m.poster].filter((p): p is string => !!p && !p.startsWith("/"));
    if (files.length) await supabase.storage.from("site-media").remove(files);
  };
  const upload = async (section: Media["section"], file: File, replace?: Media) => {
    setBusy(true);
    try {
      const isVideo = file.type.startsWith("video/");
      if (!isVideo && !file.type.startsWith("image/")) throw new Error("Choose an image or a video.");
      if (isVideo && file.size > 50 * 1024 * 1024) throw new Error("Videos must be under 50 MB. Trim or export it smaller first.");
      const id = crypto.randomUUID();
      let path: string, poster: string | null = null;
      if (isVideo) {
        const ext = file.type.includes("webm") ? "webm" : file.type.includes("quicktime") ? "mov" : "mp4";
        path = `${section}/${id}.${ext}`;
        const pb = await videoPoster(file).catch(() => null);
        if (pb) { poster = `${section}/${id}-poster.webp`; const r = await supabase.storage.from("site-media").upload(poster, pb, { contentType: "image/webp" }); if (r.error) throw r.error; }
      } else {
        path = `${section}/${id}.webp`;
        file = new File([await compressImage(file)], "x.webp", { type: "image/webp" });
      }
      const up = await supabase.storage.from("site-media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (up.error) throw up.error;
      const title = replace?.title || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 120) || "KeshCut Studio";
      if (replace) {
        const { error } = await supabase.from("site_media").update({ kind: isVideo ? "video" : "image", path, poster, title }).eq("id", replace.id);
        if (error) throw error;
        await removeFiles(replace);
      } else {
        const max = Math.max(0, ...rows.filter((r) => r.section === section).map((r) => r.sort));
        const { error } = await supabase.from("site_media").insert({ section, kind: isVideo ? "video" : "image", path, poster, title, sort: max + 1 });
        if (error) throw error;
      }
      toast(replace ? "Replaced" : "Added"); await load();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const del = async (m: Media) => {
    if (!window.confirm("Remove this from the website? The file is deleted too.")) return;
    const { error } = await supabase.from("site_media").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    await removeFiles(m); toast("Removed"); load();
  };
  const move = async (list: Media[], i: number, d: -1 | 1) => {
    const a = list[i], b = list[i + d]; if (!a || !b) return;
    await supabase.from("site_media").update({ sort: b.sort }).eq("id", a.id);
    await supabase.from("site_media").update({ sort: a.sort === b.sort ? a.sort + d : a.sort }).eq("id", b.id);
    load();
  };
  const pick = (cb: (f: File) => void) => {
    const i = document.createElement("input"); i.type = "file"; i.accept = "image/*,video/*";
    i.onchange = () => { const f = i.files?.[0]; if (f) cb(f); }; i.click();
  };
  return (
    <div className="mt-4 space-y-8">
      <p className="text-sm text-muted-foreground">Photos are shrunk automatically before upload. Replaced or removed files are deleted to save space.</p>
      {(["teach", "studio"] as const).map((sec) => {
        const list = rows.filter((r) => r.section === sec);
        return (
          <section key={sec} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl">{sec === "teach" ? "See how we teach" : "The studio"}</h2>
              <Button size="sm" disabled={busy} onClick={() => pick((f) => upload(sec, f))}><Upload />{busy ? "Uploading…" : "Add photo or video"}</Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((m, i) => (
                <div key={m.id} className="space-y-2 border border-border p-2">
                  {m.kind === "video"
                    ? <video className="aspect-[4/5] w-full bg-muted object-cover" src={src(m.path)} poster={m.poster ? src(m.poster) : undefined} controls preload="none" playsInline />
                    : <img className="aspect-[4/5] w-full object-cover" src={src(m.path)} alt={m.title} loading="lazy" />}
                  <Input className="text-base" aria-label="Caption" defaultValue={m.title} maxLength={120}
                    onBlur={async (e) => { const t = e.target.value.trim(); if (t && t !== m.title) { const { error } = await supabase.from("site_media").update({ title: t }).eq("id", m.id); if (error) toast.error(error.message); else load(); } }} />
                  <div className="flex flex-wrap gap-1">
                    <Button size="icon" variant="outline" aria-label="Move earlier" disabled={i === 0} onClick={() => move(list, i, -1)}><ArrowUp /></Button>
                    <Button size="icon" variant="outline" aria-label="Move later" disabled={i === list.length - 1} onClick={() => move(list, i, 1)}><ArrowDown /></Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => pick((f) => upload(sec, f, m))}>Replace</Button>
                    <Button size="icon" variant="destructive" aria-label="Remove" onClick={() => del(m)}><Trash2 /></Button>
                  </div>
                </div>
              ))}
              {list.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet — this section is hidden on the website.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
