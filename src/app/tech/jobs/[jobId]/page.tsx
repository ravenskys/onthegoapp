import TechnicianJobFlowPage from "./TechnicianJobFlowPage";

export default async function TechnicianJobWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams?: Promise<{ stage?: string }>;
}) {
  const { jobId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialStage =
    resolvedSearchParams?.stage &&
    [
      "dispatch",
      "arrival",
      "complaint",
      "preinspection",
      "inspection",
      "quote",
      "work",
      "payment",
      "closeout",
    ].includes(resolvedSearchParams.stage)
      ? (resolvedSearchParams.stage as
          | "dispatch"
          | "arrival"
          | "complaint"
          | "preinspection"
          | "inspection"
          | "quote"
          | "work"
          | "payment"
          | "closeout")
      : undefined;

  return <TechnicianJobFlowPage jobId={jobId} initialStage={initialStage} />;
}
