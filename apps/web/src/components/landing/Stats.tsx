import { MAX_LEVERAGE_LABEL } from '../../lib/leverage';

const STATS = [
  { value: MAX_LEVERAGE_LABEL, label: 'Max long leverage' },
  { value: '50%', label: 'Max LTV on stock collateral' },
  { value: '1 tx', label: 'To open any position' },
];

/** Protocol parameters as one solid band under the hero. */
export function Stats() {
  return (
    <section className="sf-section sf-stats-wrap" aria-label="Protocol parameters">
      <dl className="sf-card sf-stats sf-tone-lime">
        {STATS.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
