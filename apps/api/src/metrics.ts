/** In-memory counters for Prometheus text exposition (no extra deps). */

const proxyTotals = new Map<string, number>();

function tallyKey(provider: string, statusCode: string): string {
  return `${provider}\0${statusCode}`;
}

export function recordProxyRequest(provider: string, statusCode: string): void {
  const k = tallyKey(provider, statusCode);
  proxyTotals.set(k, (proxyTotals.get(k) ?? 0) + 1);
}

function escapeLabel(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

/** Prometheus text format for `GET /metrics`. */
export function renderMetrics(): string {
  const lines: string[] = [
    "# HELP gateway_proxy_requests_total Proxy requests that reached the upstream HTTP client",
    "# TYPE gateway_proxy_requests_total counter",
  ];
  for (const [k, v] of proxyTotals) {
    const sep = k.indexOf("\0");
    const provider = sep >= 0 ? k.slice(0, sep) : k;
    const status_code = sep >= 0 ? k.slice(sep + 1) : "unknown";
    lines.push(
      `gateway_proxy_requests_total{provider="${escapeLabel(provider)}",status_code="${escapeLabel(status_code)}"} ${v}`
    );
  }
  lines.push(
    "# HELP gateway_process_heap_bytes Resident set style heap used (bytes)",
    "# TYPE gateway_process_heap_bytes gauge",
    `gateway_process_heap_bytes ${process.memoryUsage().heapUsed}`
  );
  return `${lines.join("\n")}\n`;
}
