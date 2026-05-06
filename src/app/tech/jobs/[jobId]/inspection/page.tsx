import { redirect } from "next/navigation";

export default async function TechnicianLegacyInspectionWorkspacePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  redirect(`/tech/jobs/${jobId}?stage=inspection`);
}
