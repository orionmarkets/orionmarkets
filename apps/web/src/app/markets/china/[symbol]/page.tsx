import { redirect } from "next/navigation";
import { marketPath } from "../../../../lib/asset-catalog";

// Earlier builds had a separate China detail page; the live market page covers every asset now.
export default function ChinaSymbolRedirect({ params }: { params: { symbol: string } }) {
  redirect(marketPath(params.symbol));
}
