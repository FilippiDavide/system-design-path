"use client";

import { useState } from "react";

type Kind = "entered" | "tracked" | "others";

interface Ev {
  day: number;
  kind: Kind;
  label: string;
}

/** One year of events about one user, in the order they are collected. */
const EVENTS: Ev[] = [
  { day: 0, kind: "entered", label: "account: name, email" },
  { day: 2, kind: "tracked", label: "page views, scroll depth" },
  { day: 6, kind: "tracked", label: "location: home, workplace" },
  { day: 14, kind: "entered", label: "order #1, shipping address" },
  { day: 21, kind: "tracked", label: "search: symptoms of an illness" },
  { day: 35, kind: "others", label: "contacts uploaded: 212 people" },
  { day: 50, kind: "entered", label: "support ticket" },
  { day: 70, kind: "tracked", label: "ad clicks, dwell time" },
  { day: 95, kind: "tracked", label: "location: clinic, weekly" },
  { day: 130, kind: "entered", label: "order #2" },
  { day: 160, kind: "tracked", label: "voice assistant queries" },
  { day: 210, kind: "others", label: "photo of the user, tagged by a friend" },
  { day: 260, kind: "tracked", label: "A/B test exposure, timings" },
  { day: 320, kind: "entered", label: "address change" },
];

const LANES: { kind: Kind; name: string; color: string }[] = [
  { kind: "entered", name: "entered by the user", color: "var(--ink)" },
  { kind: "tracked", name: "tracked as a side effect", color: "var(--neon-2)" },
  { kind: "others", name: "about other people", color: "var(--neon-5)" },
];

const RETENTIONS: { label: string; days: number }[] = [
  { label: "30 d", days: 30 },
  { label: "90 d", days: 90 },
  { label: "1 y", days: 365 },
  { label: "forever", days: Infinity },
];

const YEAR = 365;
/** Backup snapshots are kept this long. */
const BACKUP_DAYS = 90;
/** The model is retrained this often, on whatever the primary store holds then. */
const RETRAIN_EVERY = 90;
/** Partner exports go out this often. */
const EXPORT_EVERY = 30;

type Status = "ok" | "warn" | "bad" | "none";

interface Store {
  name: string;
  tag: string;
  count: number;
  status: Status;
  note: string;
}

/**
 * Data-retention explorer. A year of events about one user is collected
 * into a primary store and fans out into an append-only log, backups,
 * a search index, a trained model and a partner export. Toggle purpose
 * limitation, retention, derivation and sharing, then file an erasure
 * request and see which copies actually go away.
 */
export function DataRetentionLab() {
  const [today, setToday] = useState(YEAR);
  const [purpose, setPurpose] = useState(false);
  const [retIdx, setRetIdx] = useState(3);
  const [derived, setDerived] = useState(true);
  const [sharing, setSharing] = useState(true);
  const [erase, setErase] = useState(false);

  const retention = RETENTIONS[retIdx].days;
  const collected = (e: Ev) => e.day <= today && (!purpose || e.kind === "entered");
  const heldAt = (e: Ev, t: number) => collected(e) && e.day <= t && t - e.day < retention;

  const collectedEvs = EVENTS.filter(collected);
  const primaryEvs = EVENTS.filter((e) => heldAt(e, today));
  const trainDay = Math.floor(today / RETRAIN_EVERY) * RETRAIN_EVERY;
  const modelEvs = derived && trainDay > 0 ? EVENTS.filter((e) => heldAt(e, trainDay)) : [];
  const exportDay = Math.floor(today / EXPORT_EVERY) * EXPORT_EVERY;
  const exportEvs = sharing ? EVENTS.filter((e) => collected(e) && e.day <= exportDay) : [];
  const backupEvs = EVENTS.filter((e) => collected(e) && today - e.day < retention + BACKUP_DAYS);

  const stores: Store[] = [
    {
      name: "Primary database",
      tag: "mutable · retention applied",
      count: erase ? 0 : primaryEvs.length,
      status: erase ? "ok" : "none",
      note: erase ? "rows deleted" : retention === Infinity ? "kept until deleted" : `purged after ${RETENTIONS[retIdx].label}`,
    },
    {
      name: "Append-only log",
      tag: "immutable · kept for replay",
      count: collectedEvs.length,
      status: erase ? "warn" : "none",
      note: erase
        ? "a deletion marker is appended; the original bytes stay until segments are rewritten or the key is crypto-shredded"
        : "every event ever collected, retention does not apply",
    },
    {
      name: "Backups",
      tag: `snapshots · ${BACKUP_DAYS} d`,
      count: backupEvs.length,
      status: erase ? "warn" : "none",
      note: erase ? `a restore would bring the rows back until the snapshots expire in ${BACKUP_DAYS} d` : "snapshots of the primary store",
    },
    {
      name: "Search index",
      tag: "derived · rebuilt nightly",
      count: derived ? primaryEvs.length : 0,
      status: !derived ? "none" : erase ? "warn" : "none",
      note: !derived ? "not built" : erase ? "still answers queries until the next rebuild from the primary store" : "mirrors the primary store",
    },
    {
      name: "Trained model",
      tag: `derived · retrained every ${RETRAIN_EVERY} d`,
      count: modelEvs.length,
      status: !derived || modelEvs.length === 0 ? "none" : erase ? "bad" : "none",
      note: !derived
        ? "not trained"
        : modelEvs.length === 0
          ? "not trained yet"
          : erase
            ? `the events are encoded in the weights: no row to delete, retrain without them (day ${trainDay} snapshot) or discard the model`
            : `trained on day ${trainDay} on what the primary store held then`,
    },
    {
      name: "Partner export",
      tag: `shared · every ${EXPORT_EVERY} d`,
      count: exportEvs.length,
      status: !sharing ? "none" : exportEvs.length === 0 ? "none" : erase ? "bad" : "none",
      note: !sharing
        ? "nothing shared"
        : exportEvs.length === 0
          ? "nothing exported yet"
          : erase
            ? "beyond reach: the recipient is not bound by this deletion and may have resold the data"
            : "copies at an advertising partner and a data broker",
    },
  ];

  const copies = stores.reduce((a, s) => a + s.count, 0);
  const irreversible = stores.filter((s) => s.status === "bad").reduce((a, s) => a + s.count, 0);
  const othersCount = collectedEvs.filter((e) => e.kind === "others").length;

  // Timeline geometry.
  const w = 760;
  const h = 168;
  const xl = 36;
  const xr = 724;
  const xOf = (d: number) => xl + (d / YEAR) * (xr - xl);
  const laneY = (k: Kind) => 44 + LANES.findIndex((l) => l.kind === k) * 28;
  const windowStart = retention === Infinity ? 0 : Math.max(0, today - retention);

  const toggle = "flex items-center gap-2 cursor-pointer";

  return (
    <div className="border border-line">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3 border-b border-line-soft font-mono text-[11px] uppercase tracking-[0.14em]">
        <label className="flex items-center gap-2">
          today
          <input type="range" min={0} max={YEAR} step={5} value={today} onChange={(e) => setToday(Number(e.target.value))} className="w-28 accent-black" />
          <span className="font-dot text-sm w-16 whitespace-nowrap">day {today}</span>
        </label>
        <label className="flex items-center gap-2">
          retention
          <span className="flex gap-px border border-line-soft">
            {RETENTIONS.map((r, i) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setRetIdx(i)}
                aria-pressed={i === retIdx}
                className={`px-2 py-1 ${i === retIdx ? "bg-ink text-surface" : "hover:bg-surface-2"}`}
              >
                {r.label}
              </button>
            ))}
          </span>
        </label>
        <label className={toggle}>
          <input type="checkbox" checked={purpose} onChange={(e) => setPurpose(e.target.checked)} className="accent-black" />
          purpose limitation
        </label>
        <label className={toggle}>
          <input type="checkbox" checked={derived} onChange={(e) => setDerived(e.target.checked)} className="accent-black" />
          derived datasets
        </label>
        <label className={toggle}>
          <input type="checkbox" checked={sharing} onChange={(e) => setSharing(e.target.checked)} className="accent-black" />
          share with partners
        </label>
        <button
          type="button"
          onClick={() => setErase((v) => !v)}
          aria-pressed={erase}
          className={`border px-3 py-1.5 ${erase ? "border-ink bg-ink text-surface" : "border-ink hover:bg-ink hover:text-surface"}`}
        >
          {erase ? "Erasure requested" : "Request erasure"}
        </button>
      </div>

      <div className="p-3 sm:p-5 bg-grid overflow-x-auto">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width="100%"
          style={{ minWidth: 600, maxWidth: w * 1.15, display: "block", margin: "0 auto" }}
          role="img"
          aria-label="Timeline of the events collected about the user over one year"
        >
          {/* Retention window */}
          {today > 0 && (
            <rect x={xOf(windowStart)} y={30} width={Math.max(0, xOf(today) - xOf(windowStart))} height={94} fill="var(--surface-2)" />
          )}
          {/* Axis */}
          <line x1={xl} y1={126} x2={xr} y2={126} stroke="var(--ink)" strokeWidth={1} />
          {[0, 90, 180, 270, 365].map((d) => (
            <g key={d}>
              <line x1={xOf(d)} y1={126} x2={xOf(d)} y2={130} stroke="var(--ink)" strokeWidth={1} />
              <text x={xOf(d)} y={142} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
                {d === 0 ? "day 0" : d}
              </text>
            </g>
          ))}
          {/* Today cursor */}
          <line x1={xOf(today)} y1={24} x2={xOf(today)} y2={126} stroke="var(--ink)" strokeWidth={1.5} />
          <text
            x={xOf(today) + (today > 300 ? -6 : 6)}
            y={18}
            textAnchor={today > 300 ? "end" : "start"}
            fontFamily="var(--font-jetbrains)"
            fontSize={10}
            fill="var(--ink)"
          >
            today{retention !== Infinity ? ` · window ${RETENTIONS[retIdx].label}` : ""}
          </text>
          {/* Lanes */}
          {LANES.map((l) => (
            <g key={l.kind}>
              <line x1={xl} y1={laneY(l.kind)} x2={xr} y2={laneY(l.kind)} stroke="var(--line-soft)" strokeWidth={1} strokeDasharray="2 3" />
              {/* white backing so the "today" cursor never runs through the lane name */}
              <rect x={xl - 2} y={laneY(l.kind) - 18} width={l.name.length * 6.6 + 4} height={12} fill="#fff" />
              <text
                x={xl}
                y={laneY(l.kind) - 9}
                fontFamily="var(--font-jetbrains)"
                fontSize={10}
                fill={l.color}
                style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                {l.name}
              </text>
            </g>
          ))}
          {/* Events */}
          {EVENTS.map((e) => {
            const future = e.day > today;
            const notCollected = !future && !collected(e);
            const held = heldAt(e, today) && !erase;
            const color = LANES.find((l) => l.kind === e.kind)?.color ?? "var(--ink)";
            const cx = xOf(e.day);
            const cy = laneY(e.kind);
            return (
              <g key={e.day} opacity={future ? 0.25 : 1}>
                <title>{`day ${e.day}: ${e.label}${notCollected ? " (not collected)" : held ? "" : future ? " (not yet)" : erase ? " (erased from the primary store)" : " (purged from the primary store)"}`}</title>
                {notCollected ? (
                  <path d={`M${cx - 4} ${cy - 4} l8 8 m0 -8 l-8 8`} stroke="var(--ink-3)" strokeWidth={1.5} fill="none" />
                ) : (
                  <circle cx={cx} cy={cy} r={5} fill={held ? color : "#fff"} stroke={color} strokeWidth={1.5} />
                )}
              </g>
            );
          })}
          {/* Key */}
          <circle cx={xl + 4} cy={160} r={4} fill="var(--ink)" />
          <text x={xl + 12} y={163} fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            held in the primary store
          </text>
          <circle cx={xl + 184} cy={160} r={4} fill="#fff" stroke="var(--ink)" strokeWidth={1.5} />
          <text x={xl + 192} y={163} fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            purged or erased
          </text>
          <path d={`M${xl + 306} 156 l8 8 m0 -8 l-8 8`} stroke="var(--ink-3)" strokeWidth={1.5} fill="none" />
          <text x={xl + 320} y={163} fontFamily="var(--font-jetbrains)" fontSize={10} fill="var(--ink-2)">
            not collected (purpose limitation)
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-px bg-line-soft border-t border-line-soft">
        <Stat label="events collected" value={`${collectedEvs.length}/${EVENTS.filter((e) => e.day <= today).length}`} />
        <Stat label="copies held across stores" value={String(copies)} />
        <Stat label={erase ? "cannot be erased" : "about other people"} value={String(erase ? irreversible : othersCount)} bad={erase ? irreversible > 0 : othersCount > 0} />
      </div>

      <ul className="border-t border-line-soft divide-y divide-line-soft">
        {stores.map((s) => (
          <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-2.5 bg-surface">
            <div className="min-w-0">
              <span className="font-semibold text-sm">{s.name}</span>
              <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2"> · {s.tag}</span>
            </div>
            <span className={`font-dot text-lg font-bold leading-none text-right ${statusClass(s.status)}`}>{s.count}</span>
            <p className={`col-span-2 text-[12px] leading-snug ${s.status === "none" ? "text-ink-2" : statusClass(s.status)}`}>{s.note}</p>
          </li>
        ))}
      </ul>

      <p className="p-3 text-[12px] text-ink-2 leading-relaxed border-t border-line-soft">
        Defaults are the big data philosophy: collect everything, keep it forever, derive and share. Purpose limitation
        and a retention period are the GDPR&apos;s data minimization: adequate, relevant, limited to what is necessary.
        The erasure request shows where immutability bites: an append-only log, a backup, a trained model and a sold
        copy all hold the data after the primary row is gone. Data you do not have cannot be leaked, stolen or compelled.
      </p>
    </div>
  );
}

function statusClass(s: Status): string {
  return s === "bad" ? "text-bad" : s === "warn" ? "text-warn" : s === "ok" ? "text-ok" : "";
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="bg-surface p-3 sm:p-4 min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2 leading-tight">{label}</p>
      <p className={`font-dot text-2xl sm:text-3xl font-bold mt-1 ${bad ? "text-bad" : ""}`}>{value}</p>
    </div>
  );
}
