import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CHINA_VISIBLE } from "../../../lib/china-visible";

export default function ChinaMarketsLayout({ children }: { children: ReactNode }) {
  if (!CHINA_VISIBLE) notFound();
  return children;
}
