import TechnicianJobFlowPage from "./TechnicianJobFlowPage";

export default async function TechnicianJobWorkspacePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  return <TechnicianJobFlowPage jobId={jobId} />;
}
