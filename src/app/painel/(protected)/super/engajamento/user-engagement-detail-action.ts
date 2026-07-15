"use server";

import { requirePermission } from "@/features/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getUserEngagementDetail, type UserEngagementDetail } from "./engajamento-queries";

// Uses the service-role client, not the caller's session client: 045_lock_down_user_engagement_rpcs.sql
// revokes EXECUTE on this RPC from the `authenticated` role entirely (it's
// security definer and would otherwise let any logged-in app user pull any
// other user's behavioral profile). requirePermission is what actually
// gates this action to super_admin.
export async function fetchUserEngagementDetail(
  targetUserId: string,
  startDate: string,
  endDate: string,
): Promise<UserEngagementDetail> {
  await requirePermission("dashboard:global:view");
  const supabase = getSupabaseAdmin();
  return getUserEngagementDetail(supabase, targetUserId, startDate, endDate);
}
