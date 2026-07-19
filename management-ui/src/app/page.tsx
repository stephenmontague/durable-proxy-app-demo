"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { FlowDiagram } from "@/components/flow-diagram";
import { ConnectionsPanel } from "@/components/dashboard/connections-panel";
import { ControlsPanel } from "@/components/dashboard/controls-panel";
import { ListenersPanel } from "@/components/dashboard/listeners-panel";
import { StatusPanel } from "@/components/dashboard/status-panel";
import { FeedTable } from "@/components/feed/feed-table";
import { Panel } from "@/components/ui-custom/panel";
import { usePoll } from "@/hooks/use-poll";
import { checkSessions } from "@/lib/actions";
import type { ControlStateResponse, DeviceSessionStatus, FeedItem } from "@/lib/types";

export default function ConsolePage() {
  // Live proxy status (applied state + liveness) from Temporal. Each poll is a getState Query — a
  // billable Action — so the cadence is deliberately slow; link status is refreshed on demand via
  // the "Check Now" button below (the checkSessions Update), not by fast polling.
  const control = usePoll<ControlStateResponse>("/api/control/state", 30000);
  const feed = usePoll<{ items: FeedItem[] }>("/api/temporal/feed", 4000);
  const cloud = usePoll<{ confirms: unknown[] }>("/api/demo/confirms", 10000);

  // On-demand live link probe (ground truth from the proxy's sockets), overlaid on the polled state.
  const [liveSessions, setLiveSessions] = useState<DeviceSessionStatus[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      const res = await checkSessions();
      setLiveSessions(res.sessions);
      setLastChecked(res.reportedAt ?? new Date().toISOString());
    } catch (e) {
      toast.error("Live link check failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setChecking(false);
    }
  }, []);

  const state = control.data?.state;
  const liveness = control.data?.liveness;
  // Idle long-polls touch the server roughly once a minute, so anything under
  // ~2 minutes still counts as alive.
  const proxyUp =
    (liveness?.controlPollers ?? 0) > 0 &&
    (liveness?.lastAccessAgoMs == null || liveness.lastAccessAgoMs < 120_000);

  return (
    <div className="flex flex-col gap-7">
      <Panel legend="Data path">
        {control.error && !control.data ? (
          <p className="readout py-6 text-center text-[12px] text-err">
            cannot reach Temporal: {control.error}
          </p>
        ) : (
          <FlowDiagram
            cloudUp={cloud.error === null && cloud.data !== null}
            proxyUp={proxyUp}
            enabled={state?.enabled ?? false}
            restartPending={(state?.lifecycleCommand ?? "NONE") !== "NONE"}
          />
        )}
      </Panel>

      <div className="grid gap-7 md:grid-cols-3">
        {control.data && <StatusPanel data={control.data} />}
        {state && <ControlsPanel state={state} onActed={control.refresh} />}
        {state && <ListenersPanel state={state} />}
      </div>

      {(() => {
        // Prefer the on-demand live probe once one has run; otherwise the polled last-reported state.
        const sessions = liveSessions ?? state?.applied?.sessions ?? [];
        const hasPersistentDevice =
          state?.devices?.some((d) => d.tcpSession?.mode === "PERSISTENT") ?? false;
        if (sessions.length === 0 && !hasPersistentDevice) return null;
        return (
          <ConnectionsPanel
            sessions={sessions}
            onCheckNow={checkNow}
            checking={checking}
            lastChecked={lastChecked}
          />
        );
      })()}

      <Panel legend="Recent traffic">
        <FeedTable items={(feed.data?.items ?? []).slice(0, 8)} compact />
      </Panel>
    </div>
  );
}
