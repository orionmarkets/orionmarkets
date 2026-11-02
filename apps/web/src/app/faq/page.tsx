import React from "react";
import type { Metadata } from "next";
import { FAQSection } from "../../components/FAQSection";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return <FAQSection />;
}
