import { DocumentWorkstation } from "@/components/workstation/document-workstation";

export default async function LessonWorkstationPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return <DocumentWorkstation lessonId={id} />;
}
