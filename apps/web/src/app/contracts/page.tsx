import React from "react";
import type { Metadata } from "next";
import { AppPage } from "../../components/AppPage";
import { ContractDirectory } from "../../components/ContractDirectory";

export const metadata: Metadata = {
  title: "Smart contracts",
  description: "Every ORIONMARKETS smart contract on this network, with links to Blockscout.",
};

// Every contract the app uses on this build's network: the core protocol, each market's isolated contracts, and Pons
// when it is deployed. The landing page shows the core group and links here.
export default function ContractsPage() {
  return (
    <AppPage
      eyebrow="Smart contracts"
      title="Every contract, in the open."
      description="The core protocol and each market's isolated contracts, listed from the same deployment the app runs on."
    >
      <ContractDirectory />
    </AppPage>
  );
}
