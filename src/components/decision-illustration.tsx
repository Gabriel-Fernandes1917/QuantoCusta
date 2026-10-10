export function DecisionIllustration() {
  return <div className="hero-art decision-art" aria-hidden="true">
    <svg viewBox="0 0 400 360" fill="none" focusable="false">
      <circle cx="200" cy="162" r="132" fill="var(--illustration-surface)" />
      <circle cx="320" cy="65" r="23" fill="var(--illustration-warm)" />
      <path d="M200 103V274M156 281H244M91 137L309 111" stroke="var(--green)" strokeWidth="9" strokeLinecap="round" />
      <circle cx="200" cy="124" r="13" fill="var(--accent)" />
      <path d="M99 137L62 207H136L99 137ZM301 115L264 185H338L301 115Z" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M53 207H145C140 245 58 245 53 207Z" fill="var(--green)" />
      <path d="M255 185H347C342 223 260 223 255 185Z" fill="var(--accent)" />
      <rect x="75" y="163" width="48" height="35" rx="6" fill="var(--surface-raised)" />
      <path d="M88 175H110M88 185H101" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <rect x="279" y="143" width="44" height="34" rx="6" fill="var(--surface-raised)" />
      <path d="M290 160L298 167L313 152" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M48 282H352" stroke="var(--line)" />
      <path d="M55 84H79M67 72V96" stroke="var(--focus)" strokeWidth="3" strokeLinecap="round" />
    </svg>
    <p className="art-caption">Olhe além do preço.<br /><strong>Compare o cenário completo.</strong></p>
  </div>;
}
