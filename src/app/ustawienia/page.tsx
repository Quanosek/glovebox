import type { Metadata } from "next";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "Ustawienia" };

export default function SettingsPage() {
  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Ustawienia</h1>
      <SettingsView />
    </main>
  );
}
