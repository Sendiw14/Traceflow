import { notFound } from "next/navigation";
import { TraceDetail } from "@/components/trace/TraceDetail";
import { first, isTraceId, type SearchParams } from "@/lib/query/params";

export async function generateMetadata({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = await params;
  return { title: `Demo trace ${traceId.slice(0, 8)}` };
}

export default async function DemoTracePage({ params, searchParams }: { params: Promise<{ traceId: string }>; searchParams: Promise<SearchParams> }) {
  const { traceId } = await params;
  if (!isTraceId(traceId)) notFound(); // invalid ID format: no API call
  const sp = await searchParams;
  return <TraceDetail traceId={traceId} spanParam={first(sp.span)} traceBase="/demo/traces" listHref="/demo#traces" listLabel="Demo traces" />;
}
