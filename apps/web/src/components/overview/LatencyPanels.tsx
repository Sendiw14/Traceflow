import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { Panel, ProblemState } from "@/components/ui";
import { formatCount } from "@/lib/format";
import { errorPoints, latencyPoints, throughputPoints } from "@/lib/series";
import type { Result, Schemas } from "@/lib/server/data";
import type { Window } from "@/lib/time/window";

/** Latency, error-rate and throughput charts from one server-latency series (shared by /app and /demo). */
export function LatencyPanels({ series, w }: { series: Result<Schemas["LatencySeries"]>; w: Window }) {
  return (
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {series.ok ? (
          <>
            <Panel title="Latency (SERVER spans)" id="lat" className="lg:col-span-2" testId="overview.latency-chart">
              <TimeSeriesChart name="latency" title="Latency percentiles" unit="duration" bucketSeconds={w.bucketSeconds}
                caption={`${w.bucketSeconds} s buckets · n=${formatCount(series.data.overall.population.sample_count)}`}
                series={[
                  { id: "p50", label: "p50", color: "var(--tf-signal)", points: latencyPoints(series.data.points, "p50") },
                  { id: "p95", label: "p95", color: "var(--tf-violet)", dash: "6 3", points: latencyPoints(series.data.points, "p95") },
                  { id: "p99", label: "p99", color: "var(--tf-ink-2)", dash: "2 3", points: latencyPoints(series.data.points, "p99") },
                ]} />
              <p className="mt-2 text-xs text-ink-3">{series.data.overall.population.note} Percentiles appear only when a bucket has enough samples (p95 ≥ 20, p99 ≥ 100).</p>
            </Panel>
            <Panel title="Error rate" id="err" testId="overview.error-chart">
              <TimeSeriesChart name="errors" title="Error rate (error SERVER spans / SERVER spans)" unit="percent" bucketSeconds={w.bucketSeconds} caption={`${w.bucketSeconds} s buckets`}
                series={[{ id: "err", label: "Error rate", color: "var(--tf-error)", points: errorPoints(series.data.points) }]} />
            </Panel>
            <Panel title="Throughput" id="thr" testId="overview.throughput-chart">
              <TimeSeriesChart name="throughput" title="Requests per second (SERVER spans)" unit="rate" bucketSeconds={w.bucketSeconds} caption={`${w.bucketSeconds} s buckets`}
                series={[{ id: "thr", label: "Requests/s", color: "var(--tf-signal-strong)", points: throughputPoints(series.data.points, w.bucketSeconds) }]} />
            </Panel>
          </>
        ) : (
          <div className="lg:col-span-2"><ProblemState problem={series.error} compact /></div>
        )}
      </div>
  );
}
