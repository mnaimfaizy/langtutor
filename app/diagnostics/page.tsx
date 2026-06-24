import type { Metadata } from "next";

import { DiagnosticsClient } from "./diagnostics-client";

export const metadata: Metadata = {
  title: "Diagnostics — Lang-Tutor",
};

export default function DiagnosticsPage() {
  return <DiagnosticsClient />;
}
