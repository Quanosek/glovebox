import { ProfileView } from "@/components/ProfileView";
import { listCarSummaries } from "@/lib/content";

export default function Home() {
  return (
    <main id="main" className="page-shell">
      <ProfileView cars={listCarSummaries()} />
    </main>
  );
}
