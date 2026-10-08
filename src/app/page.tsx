import { ProfileView } from "@/components/ProfileView";
import { listCarSummaries } from "@/lib/content";

export default function Home() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8"
    >
      <ProfileView cars={listCarSummaries()} />
    </main>
  );
}
