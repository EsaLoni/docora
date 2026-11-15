"""Operational Metrics and Monitoring Registry.

Provides thread-safe in-memory metrics collection with Prometheus-compatible
text exposition and JSON structured summaries for observability dashboards.
"""

from collections import defaultdict
import threading
import time
from typing import Any, Dict, List, Tuple


class MetricsCollector:
    """Thread-safe collector for application performance and worker metrics."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._startup_time = time.time()

        # HTTP Metrics: (method, endpoint, status_code) -> count
        self._http_requests_total: Dict[Tuple[str, str, int], int] = defaultdict(int)

        # HTTP Durations: (endpoint) -> list of recent latencies in seconds (kept bounded)
        self._http_durations: Dict[str, List[float]] = defaultdict(list)
        self._max_duration_samples = 500

        # Background Worker Metrics
        self._worker_jobs_total: Dict[str, int] = defaultdict(int)  # status: completed, failed
        self._active_worker_jobs = 0

        # AI / LLM Metrics
        self._llm_inference_total = 0
        self._llm_total_tokens = 0
        self._llm_errors_total = 0

    def record_http_request(self, method: str, path: str, status_code: int, duration_seconds: float) -> None:
        """Record an HTTP request completion."""
        with self._lock:
            # Normalize path to avoid high-cardinality metrics (collapse UUIDs)
            normalized_path = self._normalize_path(path)
            self._http_requests_total[(method.upper(), normalized_path, status_code)] += 1

            samples = self._http_durations[normalized_path]
            samples.append(duration_seconds)
            if len(samples) > self._max_duration_samples:
                samples.pop(0)

    def record_worker_job(self, job_type: str, status: str) -> None:
        """Record a completed or failed background worker job."""
        with self._lock:
            self._worker_jobs_total[f"{job_type}_{status.lower()}"] += 1

    def set_active_worker_jobs(self, count: int) -> None:
        """Update the gauge of currently active jobs."""
        with self._lock:
            self._active_worker_jobs = count

    def record_llm_inference(self, tokens_used: int = 0, is_error: bool = False) -> None:
        """Record LLM inference invocation and token consumption."""
        with self._lock:
            self._llm_inference_total += 1
            self._llm_total_tokens += tokens_used
            if is_error:
                self._llm_errors_total += 1

    def _normalize_path(self, path: str) -> str:
        """Collapse UUIDs and numeric IDs in path strings to prevent metric cardinality explosion."""
        import re
        # Replace UUID-like strings
        cleaned = re.sub(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "{id}", path)
        # Replace hex IDs
        cleaned = re.sub(r"/[0-9a-fA-F]{16,}/", "/{id}/", cleaned)
        return cleaned

    def get_summary(self) -> Dict[str, Any]:
        """Return structured JSON metrics summary."""
        with self._lock:
            uptime = round(time.time() - self._startup_time, 2)
            total_requests = sum(self._http_requests_total.values())

            # Calculate average latencies
            latency_by_path: Dict[str, Dict[str, float]] = {}
            for path, samples in self._http_durations.items():
                if samples:
                    latency_by_path[path] = {
                        "count": len(samples),
                        "avg_ms": round((sum(samples) / len(samples)) * 1000, 2),
                        "max_ms": round(max(samples) * 1000, 2),
                        "p95_ms": round(sorted(samples)[int(len(samples) * 0.95)] * 1000, 2) if len(samples) >= 20 else round(max(samples) * 1000, 2),
                    }

            return {
                "uptime_seconds": uptime,
                "total_http_requests": total_requests,
                "requests_by_status": {
                    f"{method} {path} [{status}]": count
                    for (method, path, status), count in self._http_requests_total.items()
                },
                "latency_summary": latency_by_path,
                "worker_jobs": dict(self._worker_jobs_total),
                "active_worker_jobs": self._active_worker_jobs,
                "llm_inference": {
                    "total_calls": self._llm_inference_total,
                    "total_tokens_estimated": self._llm_total_tokens,
                    "errors": self._llm_errors_total,
                },
            }

    def to_prometheus(self) -> str:
        """Generate Prometheus exposition format metrics text."""
        lines = [
            "# HELP udip_uptime_seconds Total application process uptime in seconds",
            "# TYPE udip_uptime_seconds gauge",
            f"udip_uptime_seconds {round(time.time() - self._startup_time, 2)}",
            "",
            "# HELP udip_http_requests_total Total HTTP requests handled",
            "# TYPE udip_http_requests_total counter",
        ]

        with self._lock:
            for (method, path, status), count in sorted(self._http_requests_total.items()):
                lines.append(f'udip_http_requests_total{{method="{method}",path="{path}",status="{status}"}} {count}')

            lines.append("")
            lines.append("# HELP udip_worker_jobs_total Total background worker jobs processed")
            lines.append("# TYPE udip_worker_jobs_total counter")
            for job_stat, count in sorted(self._worker_jobs_total.items()):
                lines.append(f'udip_worker_jobs_total{{stat="{job_stat}"}} {count}')

            lines.append("")
            lines.append("# HELP udip_active_worker_jobs Current number of actively processing jobs")
            lines.append("# TYPE udip_active_worker_jobs gauge")
            lines.append(f"udip_active_worker_jobs {self._active_worker_jobs}")

            lines.append("")
            lines.append("# HELP udip_llm_inference_calls_total Total LLM inference invocations")
            lines.append("# TYPE udip_llm_inference_calls_total counter")
            lines.append(f"udip_llm_inference_calls_total {self._llm_inference_total}")

            lines.append("")
            lines.append("# HELP udip_llm_tokens_total Estimated tokens consumed across LLM inference")
            lines.append("# TYPE udip_llm_tokens_total counter")
            lines.append(f"udip_llm_tokens_total {self._llm_total_tokens}")

        lines.append("")
        return "\n".join(lines)


# Global singleton metrics collector instance
metrics = MetricsCollector()
