import { UnitView } from "./unit-view";

export const metadata = { title: "Unit — Lang-Tutor" };

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UnitView id={Number(id)} />;
}
