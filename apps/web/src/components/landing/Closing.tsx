import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { HAS_X, X_URL, X_HANDLE } from '../../lib/social';
import { BrandMark } from '../navigation';

export function Closing() {
  return (
    <section className="sf-section sf-closing-wrap" aria-labelledby="closing-title">
      <div className="sf-card sf-closing sf-tone-lime">
        <span className="sf-mark-tile" aria-hidden="true">
          <BrandMark size={44} />
        </span>
        <h2 id="closing-title" className="display-lg">
          The sky is mapped. Take the shot.
        </h2>
        <p>Tokenized equities, leverage and credit on Robinhood Chain.</p>
        <div className="sf-actions">
          <Link href="/markets" className="sf-btn">
            Launch app <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          {HAS_X && (
            <a href={X_URL} className="sf-btn sf-btn-outline" target="_blank" rel="noopener noreferrer">
              Follow @{X_HANDLE}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
