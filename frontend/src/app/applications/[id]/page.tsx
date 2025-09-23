'use client';

import { useRouter } from 'next/navigation';
import { ApplicationDetailPanel } from '@/components/ApplicationDetailPanel';
import Link from 'next/link';

interface PageProps {
  params: { id: string };
}

export default function ApplicationDetailPage({ params }: PageProps) {
  const router = useRouter();
  const applicationId = params.id;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 999,
            padding: '8px 16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <Link href="/issues" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
          View all issues
        </Link>
      </div>
      <ApplicationDetailPanel applicationId={applicationId} onClose={() => router.back()} />
    </div>
  );
}
