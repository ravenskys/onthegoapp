import { TechnicianWorkspacePage } from "@/app/tech/page";

export default async function TechnicianJobWorkspacePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  return <TechnicianWorkspacePage initialJobId={jobId} queueHref="/tech/jobs" />;
}
