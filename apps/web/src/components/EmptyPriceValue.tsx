/** Display-only placeholder while a verified price syncs: a shimmer, never a fake number. Missing quotes stay null
 * in financial calculations. */
export function EmptyPriceValue() {
  return (
    <span className="price-sync" role="status" aria-label="Syncing verified price">
      <span aria-hidden="true" />
    </span>
  );
}
