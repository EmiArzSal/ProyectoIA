"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUpIcon } from "lucide-react";
import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { CEFR_LEVELS, cefrRank } from "@/lib/report-columns";
import type { EvolutionPoint, ScoreKey, Trend } from "@/modules/progress/evolution";
import { useTRPC } from "@/trpc/client";

// Categorical slots of the validated reference palette (dataviz skill), one
// per measure across both score charts, so a color always means the same
// thing. Three sit below 3:1 on white: every line is direct-labeled and the
// table view repeats the values.
const SERIES: Record<ScoreKey, { label: string; color: string }> = {
  grammar:    { label: "Gramática",    color: "#2a78d6" },
  vocabulary: { label: "Vocabulario",  color: "#eb6834" },
  fluency:    { label: "Fluidez",      color: "#1baf7a" },
  technical:  { label: "Técnica",      color: "#eda100" },
  softSkills: { label: "Soft skills",  color: "#e87ba4" },
};
const LEVEL_COLOR = "#6250d6"; // single series: violet, as the topic levels

const ENGLISH_KEYS: ScoreKey[] = ["grammar", "vocabulary", "fluency"];
const INTERVIEW_KEYS: ScoreKey[] = ["technical", "softSkills"];

type Row = {
  label: string;
  date: string;
  role: string;
  level: number | null;
  levelName: string | null;
} & Record<ScoreKey, number | null>;

const toRows = (points: EvolutionPoint[]): Row[] =>
  points.map((p) => ({
    label: format(new Date(p.date), "d MMM", { locale: es }),
    date: format(new Date(p.date), "d 'de' MMMM, HH:mm", { locale: es }),
    role: p.role,
    level: p.englishLevel ? cefrRank(p.englishLevel) : null,
    levelName: p.englishLevel,
    ...p.scores,
  }));

const formatScore = (n: number | null) => (n === null ? "—" : n.toFixed(1).replace(/\.0$/, ""));

// ── Pieces ────────────────────────────────────────────────────────────────────

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
    </div>
  );
}

const LABEL_GAP = 13; // px between stacked end labels

/** The series name at the last point of its line (identity is never color alone). */
function endLabel(name: string, lastIndex: number, offset: number) {
  // eslint-disable-next-line react/display-name
  return (props: { x?: number | string; y?: number | string; index?: number; value?: unknown }) => {
    if (props.index !== lastIndex || props.value == null) return null;
    return (
      <text x={Number(props.x) + 8} y={Number(props.y) + offset} dy={4} className="fill-muted-foreground text-[11px]">
        {name}
      </text>
    );
  };
}

/** Vertical offsets so lines ending at the same value get stacked labels instead of overlapping ones. */
function endLabelOffsets(rows: Row[], keys: ScoreKey[]): Record<string, number> {
  const groups = new Map<number, ScoreKey[]>();
  for (const k of keys) {
    const i = lastIndexWithValue(rows, k);
    if (i < 0 || i !== rows.length - 1) continue; // only lines that reach the last interview can collide
    const v = rows[i][k] as number;
    groups.set(v, [...(groups.get(v) ?? []), k]);
  }
  const offsets: Record<string, number> = {};
  for (const tied of groups.values()) {
    tied.forEach((k, i) => { offsets[k] = (i - (tied.length - 1) / 2) * LABEL_GAP; });
  }
  return offsets;
}

function TooltipCard({
  active,
  payload,
  keys,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  keys: (ScoreKey | "level")[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md min-w-40">
      <p className="font-medium text-foreground">{row.role}</p>
      <p className="text-muted-foreground mb-1.5">{row.date}</p>
      {keys.map((key) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: key === "level" ? LEVEL_COLOR : SERIES[key].color }} />
            {key === "level" ? "Nivel" : SERIES[key].label}
          </span>
          <span className="font-medium text-foreground tabular-nums">
            {key === "level" ? (row.levelName ?? "—") : formatScore(row[key])}
          </span>
        </div>
      ))}
    </div>
  );
}

function Legend({ keys }: { keys: ScoreKey[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {keys.map((key) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES[key].color }} />
          {SERIES[key].label}
        </span>
      ))}
    </div>
  );
}

function TrendLine({ keys, trends }: { keys: ScoreKey[]; trends: Record<ScoreKey, Trend | null> }) {
  const shown = keys.filter((k) => trends[k]);
  if (shown.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Desde tus primeras entrevistas:{" "}
      {shown.map((k, i) => {
        const t = trends[k]!;
        return (
          <span key={k}>
            {i > 0 && " · "}
            {SERIES[k].label} {formatScore(t.first)} → {formatScore(t.last)}{" "}
            <span className={cn("font-medium", t.change > 0 ? "text-emerald-700" : t.change < 0 ? "text-red-700" : "text-foreground")}>
              ({t.change > 0 ? "+" : ""}{formatScore(t.change)})
            </span>
          </span>
        );
      })}
    </p>
  );
}

function ScoreChart({ title, keys, rows, trends }: {
  title: string;
  keys: ScoreKey[];
  rows: Row[];
  trends: Record<ScoreKey, Trend | null>;
}) {
  const config = Object.fromEntries(keys.map((k) => [k, { label: SERIES[k].label, color: SERIES[k].color }])) satisfies ChartConfig;
  const offsets = endLabelOffsets(rows, keys);
  return (
    <div className="rounded-xl border bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">Calificación de 1 a 5</p>
        </div>
        <Legend keys={keys} />
      </div>
      <ChartContainer config={config} className="aspect-auto h-52 w-full">
        <LineChart data={rows} margin={{ top: 8, right: 84, bottom: 0, left: -24 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} width={48} />
          <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<TooltipCard keys={keys} />} />
          {keys.map((k) => (
            <Line
              key={k}
              dataKey={k}
              type="linear"
              stroke={SERIES[k].color}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: SERIES[k].color }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              connectNulls
              isAnimationActive={false}
            >
              <LabelList dataKey={k} content={endLabel(SERIES[k].label, lastIndexWithValue(rows, k), offsets[k] ?? 0)} />
            </Line>
          ))}
        </LineChart>
      </ChartContainer>
      <TrendLine keys={keys} trends={trends} />
    </div>
  );
}

const lastIndexWithValue = (rows: Row[], key: keyof Row) => {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i][key] != null) return i;
  return -1;
};

function EvolutionTable({ rows }: { rows: Row[] }) {
  return (
    <details className="group">
      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground w-fit">Ver como tabla</summary>
      <div className="mt-2 overflow-x-auto rounded-xl border">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Fecha</th>
              <th className="px-3 py-2 text-left font-medium">Entrevista</th>
              <th className="px-3 py-2 text-left font-medium">Nivel</th>
              {[...ENGLISH_KEYS, ...INTERVIEW_KEYS].map((k) => (
                <th key={k} className="px-3 py-2 text-right font-medium">{SERIES[k].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.role}</td>
                <td className="px-3 py-2">{r.levelName ?? "—"}</td>
                {[...ENGLISH_KEYS, ...INTERVIEW_KEYS].map((k) => (
                  <td key={k} className="px-3 py-2 text-right tabular-nums">{formatScore(r[k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

/** "Tu evolución": English level and scores across the latest evaluated interviews. */
export function EvolutionSection() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.progress.getEvolution.queryOptions());
  if (!data) return null;

  const { points, summary } = data;
  const rows = toRows(points);
  const levelChange = summary.levelChange;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <TrendingUpIcon className="size-4 text-violet-600" />
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Tu evolución</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile
          label="Nivel de inglés actual"
          value={summary.latestLevel ?? "—"}
          detail={
            levelChange === null ? undefined
              : levelChange === 0 ? "Igual que en tu primera entrevista"
              : `${levelChange > 0 ? "+" : ""}${levelChange} ${Math.abs(levelChange) === 1 ? "nivel" : "niveles"} desde tu primera entrevista`
          }
        />
        <StatTile label="Mejor nivel" value={summary.bestLevel ?? "—"} />
        <StatTile
          label="Entrevistas evaluadas"
          value={String(summary.evaluated)}
          detail={summary.evaluated >= 20 ? "Se muestran las 20 más recientes" : undefined}
        />
      </div>

      {points.length < 2 ? (
        <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
          {points.length === 0
            ? "Cuando completes entrevistas con respuestas, aquí verás cómo cambian tu nivel y tus calificaciones."
            : "Completa una entrevista más con respuestas para ver cómo cambian tu nivel y tus calificaciones."}
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-white p-4 flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold">Nivel de inglés</h3>
              <p className="text-xs text-muted-foreground">Nivel MCER estimado en cada entrevista</p>
            </div>
            <ChartContainer config={{ level: { label: "Nivel", color: LEVEL_COLOR } }} className="aspect-auto h-44 w-full">
              <LineChart data={rows} margin={{ top: 8, right: 24, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                <YAxis
                  domain={[1, 6]}
                  ticks={[1, 2, 3, 4, 5, 6]}
                  tickFormatter={(v: number) => CEFR_LEVELS[v - 1] ?? ""}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<TooltipCard keys={["level"]} />} />
                <Line
                  dataKey="level"
                  type="stepAfter"
                  stroke={LEVEL_COLOR}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: LEVEL_COLOR }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ScoreChart title="Inglés" keys={ENGLISH_KEYS} rows={rows} trends={summary.trends} />
            <ScoreChart title="Respuestas" keys={INTERVIEW_KEYS} rows={rows} trends={summary.trends} />
          </div>

          <EvolutionTable rows={rows} />
        </>
      )}
    </section>
  );
}
