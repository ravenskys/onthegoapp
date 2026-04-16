"use client";

import { supabase } from "@/lib/supabase";

export type JobCustomerUpdateType =
  | "arrival"
  | "diagnosis"
  | "parts_delay"
  | "service_complete"
  | "status"
  | "general"
  | "customer_approval";

export type JobCustomerUpdateVisibility = "internal" | "customer";

export type JobCustomerUpdateRow = {
  id: string;
  job_id: string;
  created_by_user_id: string | null;
  update_type: JobCustomerUpdateType;
  status_snapshot: string | null;
  title: string;
  message: string;
  visibility: JobCustomerUpdateVisibility;
  created_at: string;
  updated_at?: string;
};

export const fetchJobCustomerUpdates = async (jobId: string) => {
  const { data, error } = await supabase
    .from("job_customer_updates")
    .select("id, job_id, created_by_user_id, update_type, status_snapshot, title, message, visibility, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as JobCustomerUpdateRow[];
};

export const createJobCustomerUpdate = async (payload: {
  job_id: string;
  update_type: JobCustomerUpdateType;
  status_snapshot?: string | null;
  title: string;
  message: string;
  visibility: JobCustomerUpdateVisibility;
}) => {
  const { data, error } = await supabase
    .from("job_customer_updates")
    .insert(payload)
    .select("id, job_id, created_by_user_id, update_type, status_snapshot, title, message, visibility, created_at")
    .single();
  if (error) throw error;
  return data as JobCustomerUpdateRow;
};
