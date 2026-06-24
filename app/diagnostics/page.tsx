import type { Metadata } from "next";

import { DiagnosticsClientLazy } from "./diagnostics-loader";

export const metadata: Metadata = { title: "Diagnostics — Lang-Tutor" };

export default function DiagnosticsPage() {
  return <DiagnosticsClientLazy />;
}
