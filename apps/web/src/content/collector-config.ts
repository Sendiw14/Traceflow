// Verbatim copy of infra/otel/collector.yaml; src/content/collector-config.test.ts fails if it drifts.
export const COLLECTOR_YAML = `# OpenTelemetry Collector — pinned otel/opentelemetry-collector-contrib:0.165.0 (ADR-0003).
# No \`batch\` processor (deprecated 2026-11-11). Batching is exporter-level via sending_queue.batch.
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

processors:
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 20
  # Redaction before persistence, layer 1 (docs/security/privacy.md). Go applies layer 2.
  attributes/redact:
    actions:
      - { pattern: "(?i).*(authorization|cookie|password|passwd|secret|token|api[_-]?key|session).*", action: delete }
      - { key: http.request.body, action: delete }
      - { key: http.response.body, action: delete }

exporters:
  otlp_http/traceflow:
    traces_endpoint: http://trace-api:4318/v1/traces # gitleaks:allow internal URL, not a secret
    encoding: proto
    compression: gzip
    timeout: 10s
    retry_on_failure:
      enabled: true
      initial_interval: 1s
      max_interval: 30s
      max_elapsed_time: 300s
    sending_queue:
      enabled: true
      sizer: items
      queue_size: 50000
      batch:
        flush_timeout: 1s
        min_size: 512
        max_size: 2048   # worst-case ≈ 2048 × ~3 KiB ≈ 6 MiB raw, < 50% of receiver 16 MiB limit

service:
  telemetry:
    metrics:
      level: normal
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, attributes/redact]
      exporters: [otlp_http/traceflow]
`;
