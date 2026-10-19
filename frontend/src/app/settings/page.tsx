import type { Metadata } from "next";

import { SettingsPageClient } from "@/components/SettingsPageClient";

export const metadata: Metadata = {
  title: "Azure keys",
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
