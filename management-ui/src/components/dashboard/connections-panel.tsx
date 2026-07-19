"use client";

import { Button } from "@/components/ui/button";
import { Led } from "@/components/ui-custom/led";
import { Panel } from "@/components/ui-custom/panel";
import { formatClock } from "@/lib/format";
import type { LedState } from "@/lib/format";
import type { DeviceSessionStatus } from "@/lib/types";

function sessionLed(state: string): LedState {
  switch (state) {
    case "UP":
      return "ok";
    case "CONNECTING":
      return "busy";
    default:
      return "err"; // DOWN
  }
}

/**
 * The connection table: per-device persistent-link health. By default this shows the state the proxy
 * pushed on its last UP/DOWN/CONNECTING transition (via AppliedStatus.sessions — heartbeats stay out
 * of Temporal). "Check Now" fires the checkSessions Update for a live probe: the proxy reads the
 * sockets right now and returns ground truth, one billable Action per click (no polling).
 */
export function ConnectionsPanel({
  sessions,
  onCheckNow,
  checking = false,
  lastChecked = null,
}: {
  sessions: DeviceSessionStatus[];
  onCheckNow?: () => void;
  checking?: boolean;
  lastChecked?: string | null;
}) {
  return (
    <Panel legend="Persistent connections">
      {onCheckNow && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="readout text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {lastChecked ? `live · checked ${formatClock(lastChecked)}` : "last reported state"}
          </span>
          <Button
            className="btn-hard font-mono text-[10px] tracking-[0.12em] uppercase"
            variant="outline"
            size="xs"
            disabled={checking}
            onClick={onCheckNow}
          >
            {checking ? "Checking…" : "Check Now"}
          </Button>
        </div>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-ink/60 text-left">
            {["Device", "Role", "Link", "Last heartbeat", "In-flight"].map((h) => (
              <th
                key={h}
                className="readout pb-1 pr-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-faint"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 && (
            <tr>
              <td colSpan={5} className="readout py-3 text-center text-[10px] text-ink-faint">
                no session reported yet — hit Check Now for a live probe
              </td>
            </tr>
          )}
          {sessions.map((s) => (
            <tr key={s.deviceId} className="border-b border-hairline/70">
              <td className="readout py-1.5 pr-2 text-[11px] font-medium">{s.deviceId}</td>
              <td className="readout py-1.5 pr-2 text-[10px] text-ink-soft">{s.role}</td>
              <td className="py-1.5 pr-2">
                <span className="inline-flex items-center gap-2">
                  <Led state={sessionLed(s.state)} />
                  <span className="readout text-[10px] uppercase tracking-[0.12em]">{s.state}</span>
                </span>
              </td>
              <td className="readout py-1.5 pr-2 text-[11px] text-ink-soft">
                {formatClock(s.lastHeartbeatAt)}
              </td>
              <td className="readout py-1.5 text-[11px] text-ink-soft">{s.inflight}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
