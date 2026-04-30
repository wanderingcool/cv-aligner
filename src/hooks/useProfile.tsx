import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useProfile(userId: string | null | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) { setProfile(null); return; }
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { profile, loading, refresh };
}

export function effectiveTier(p: Profile | null): "free" | "active_hunter" | "passive_leap" {
  if (!p) return "free";
  if (p.subscription_tier === "active_hunter") {
    if (!p.active_hunter_until || new Date(p.active_hunter_until) > new Date()) return "active_hunter";
  }
  if ((p.passive_leap_credits ?? 0) > 0) return "passive_leap";
  return "free";
}