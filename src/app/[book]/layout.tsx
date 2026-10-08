import { notFound } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { BOOKS, getBookByRoute } from "@/lib/content";
import { getSidebarBooks } from "@/lib/sidebar";

export const dynamicParams = false;

export function generateStaticParams() {
  return BOOKS.map((b) => ({ book: b.route }));
}

export default async function BookLayout({ children, params }: LayoutProps<"/[book]">) {
  const { book } = await params;
  if (!getBookByRoute(book)) notFound();
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <Sidebar books={getSidebarBooks()} current={`/${book}`} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
