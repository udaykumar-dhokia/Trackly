from __future__ import annotations

import logging
from typing import Any, Dict, List

from app.models.orm import Span, Trace

logger = logging.getLogger(__name__)

COST_SPIKE_THRESHOLD_USD = 0.10
LATENCY_BOTTLENECK_THRESHOLD_MS = 5000
RETRY_STORM_THRESHOLD = 1

def generate_trace_insights(trace: Trace, spans: List[Span]) -> List[Dict[str, Any]]:
    """
    Analyzes a trace and its spans to generate plain-English insights.
    """
    insights = []
    
    if not spans:
        return insights

    # 1. Cost Spike Detection
    total_cost = float(trace.total_cost_usd or 0)
    for span in spans:
        span_cost = float(span.estimated_cost_usd or 0)
        if span_cost > COST_SPIKE_THRESHOLD_USD:
            insights.append({
                "type": "cost",
                "title": "Cost Spike",
                "subject": span.name or "Unknown Step",
                "value": f"${span_cost:.4f}",
                "message": f"Step '{span.name}' cost is significantly above the performance baseline.",
                "action": "Consider switching to a model with lower output pricing or optimizing prompt length.",
                "severity": "warning",
                "step_id": str(span.span_id)
            })
        elif total_cost > 0 and (span_cost / total_cost) > 0.5:
            pct = (span_cost / total_cost) * 100
            insights.append({
                "type": "cost",
                "title": "High Relative Cost",
                "subject": span.name or "Unknown Step",
                "value": f"{pct:.0f}% of run",
                "message": f"Step '{span.name}' dominates the cost structure of this trace.",
                "action": "Review if this step requires a reasoning-heavy model or if a faster model suffices.",
                "severity": "info",
                "step_id": str(span.span_id)
            })

    # 2. Latency Bottleneck Detection
    total_latency = trace.total_latency_ms or 0
    for span in spans:
        latency = span.latency_ms or 0
        if latency > LATENCY_BOTTLENECK_THRESHOLD_MS:
            insights.append({
                "type": "latency",
                "title": "Latency Bottleneck",
                "subject": span.name or "Unknown Step",
                "value": f"{latency/1000:.1f}s",
                "message": f"Step '{span.name}' exceeded the 5s performance threshold.",
                "action": "Enable streaming or verify connectivity to the provider endpoint.",
                "severity": "warning",
                "step_id": str(span.span_id)
            })
        elif total_latency > 0 and (latency / total_latency) > 0.6:
            pct = (latency / total_latency) * 100
            insights.append({
                "type": "latency",
                "title": "Critical Path Slowdown",
                "subject": span.name or "Unknown Step",
                "value": f"{pct:.0f}% of time",
                "message": f"Step '{span.name}' is the primary bottleneck in this execution.",
                "action": "Parallelize this step or move it to a lower-latency region.",
                "severity": "info",
                "step_id": str(span.span_id)
            })

    # 3. Retry Storm Detection
    name_counts: Dict[str, int] = {}
    for span in spans:
        if span.name:
            name_counts[span.name] = name_counts.get(span.name, 0) + 1
    
    for name, count in name_counts.items():
        if count > RETRY_STORM_THRESHOLD:
            insights.append({
                "type": "retry",
                "title": "Retry Storm",
                "subject": name,
                "value": f"{count} Retries",
                "message": f"Step '{name}' was executed multiple times, indicating a tool-use loop.",
                "action": "Clarify tool definitions in the prompt to help the model escape the logic loop.",
                "severity": "error",
            })

    # 4. Tool/Step Failure Detection
    failed_steps = [s for s in spans if s.status == "error"]
    if failed_steps:
        if len(failed_steps) == 1:
            insights.append({
                "type": "failure",
                "title": "Step Failure",
                "subject": failed_steps[0].name or "Unknown Step",
                "value": "CRITICAL",
                "message": f"Execution failed at '{failed_steps[0].name}': {failed_steps[0].status_message or 'Unknown error'}",
                "action": "Check provider API status or verify input parameters for this step.",
                "severity": "error",
                "step_id": str(failed_steps[0].span_id)
            })
        else:
            insights.append({
                "type": "failure",
                "title": "Multiple Failures",
                "subject": f"{len(failed_steps)} Failures",
                "value": "SYSTEM ERROR",
                "message": "Multiple steps failed. The system reliability is significantly compromised.",
                "action": "Implement circuit breakers or automated fallback models for these steps.",
                "severity": "error",
            })

    return insights
