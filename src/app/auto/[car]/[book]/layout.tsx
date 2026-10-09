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
    <div className="reader-frame">
      <Sidebar books={getSidebarBooks(ctx.car)} current={bookHref(car, book)} />
      <main id="main" className="reader-main">
        <div className="reader-column">{children}</div>
      </main>
    </div>
  );
}
