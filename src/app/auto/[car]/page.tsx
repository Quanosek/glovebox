import { redirect } from "next/navigation";
import { equipmentHref } from "@/lib/cars";

export default async function CarPage({ params }: PageProps<"/auto/[car]">) {
  const { car } = await params;
  redirect(equipmentHref(car));
}
