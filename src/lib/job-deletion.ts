"use client";

import { supabase } from "@/lib/supabase";

export async function deleteJobWithRelatedRecords(jobId: string) {
  const { error: jobDeleteError } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId);

  if (jobDeleteError) {
    throw jobDeleteError;
  }
}
