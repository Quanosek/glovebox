import { notFound } from "next/navigation";
import { ActiveCarTracker } from "@/components/ActiveCarTracker";
import { getCar } from "@/lib/content";

export default async function CarLayout({
  children,
  params,
}: LayoutProps<"/auto/[car]">) {
  const { car } = await params;
  if (!getCar(car)) notFound();
  return (
    <>
      <ActiveCarTracker car={car} />
      {children}
    </>
  );
}
