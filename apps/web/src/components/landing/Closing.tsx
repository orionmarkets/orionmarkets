import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Constellation } from '../orion/Constellation';
import { HAS_X, X_URL, X_HANDLE } from '../../lib/social';

export function Closing() {
  return (
    <section className="closing theme-inverse" aria-labelledby="closing-title">
      <Constellation seed="orion-closing" className="closing-stars" stars={12} dense={140} />
      <div className="closing-inner">
        <span className="kicker">Your move</span>
        <h2 id="closing-title" className="display-xl">
          The sky is mapped. <span className="hl">Take the shot.</span>
        </h2>
        <div className="hero-cta">
          <Link href="/markets" className="landing-btn btn-lg">
            Launch app <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          {HAS_X && (
            <a href={X_URL} className="landing-btn landing-btn-outline btn-lg" target="_blank" rel="noopener noreferrer">
              Follow @{X_HANDLE}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
