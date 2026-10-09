import { ProfileView } from "@/components/ProfileView";
import { getTips } from "@/lib/carOverview";
import { listCarSummaries, listCars } from "@/lib/content";

export default function Home() {
  return (
    <main id="main" className="page-shell">
      <ProfileView cars={listCarSummaries()} tips={getTips(listCars())} />
    </main>
  );
}
