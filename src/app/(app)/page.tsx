import { listPrds } from '@/lib/db';
import PrdList from '@/components/PrdList';

export const dynamic = 'force-dynamic';

function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function Home() {
  // Timestamps are formatted here rather than in the client component so the server
  // and browser cannot disagree about the local timezone during hydration.
  const prds = listPrds().map((p) => ({ ...p, updated_label: formatStamp(p.updated_at) }));
  return <PrdList prds={prds} />;
}
