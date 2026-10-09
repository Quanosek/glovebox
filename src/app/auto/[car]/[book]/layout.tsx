import { notFound } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { bookHref } from "@/lib/cars";
import { getBookCtx } from "@/lib/content";
import { getSidebarBooks } from "@/lib/sidebar";

export default async function BookLayout({
  children,
  params,
}: LayoutProps<"/auto/[car]/[book]">) {
  const { car, book } = await params;
  const ctx = getBookCtx(car, book);
  if (!ctx) notFound();
  return (
    <div className="mx-auto flex w-full max-w-app flex-1 flex-col lg:flex-row">
      <Sidebar books={getSidebarBooks(ctx.car)} current={bookHref(car, book)} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl min-[90rem]:has-[.reader-grid]:max-w-[63.5rem]">
          {children}
        </div>
      </main>
    </div>
  );
}
