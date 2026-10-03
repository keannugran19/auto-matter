import { FormatTransferReport } from "@/components/report/format-transfer-report";

export default async function LessonReportPage(props: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id, runId } = await props.params;
  return <FormatTransferReport lessonId={id} runId={runId} />;
}
