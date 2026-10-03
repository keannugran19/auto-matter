import { redirect } from "next/navigation";

export default async function LessonDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  redirect(`/lessons/${id}/workstation`);
}
