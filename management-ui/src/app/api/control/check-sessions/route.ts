import { controlHandle, errorResponse, temporalClient } from "@/lib/temporal";
import type { AppliedStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// On-demand LIVE link probe. Invokes the proxy-control workflow's `checkSessions` Update, which runs a
// lightweight activity on the proxy to read each device's current persistent-TCP state straight from
// the sockets — ground truth, not the polled read model. One billable Action per call, so this backs
// the dashboard's "Check Now" button; it is never polled. A failure means the proxy is unreachable
// (the activity couldn't run), which the UI already distinguishes via worker liveness.
export async function POST() {
  try {
    const client = await temporalClient();
    const applied = await controlHandle(client).executeUpdate<AppliedStatus, []>("checkSessions");
    return Response.json({
      sessions: applied?.sessions ?? [],
      reportedAt: applied?.reportedAt ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
