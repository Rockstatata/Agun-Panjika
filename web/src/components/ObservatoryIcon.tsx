/** Small consistent line icons for the overview cards. */
export function ObservatoryIcon({ kind }: { kind: 'fire' | 'calendar' | 'satellite' }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'fire' ? <><path d="M12 2c1 5 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 3-8l3 4c1-3 1-5 1-9Z" /><path d="M12 13c2 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5Z" /></> : kind === 'calendar' ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6m10-6v6M3 11h18m-14 4h2m4 0h2m-8 3h2" /></> : <><path d="m9 9 6 6m-7-3 4-4 4 4-4 4-4-4ZM2 6l4-4 4 4-4 4-4-4Zm12 12 4-4 4 4-4 4-4-4ZM6 18l-3 3m2-8a6 6 0 0 1 6 6m-6-3a3 3 0 0 1 3 3" /></>}
  </svg>;
}
