import type { Metadata } from 'next';
import { ApplicationsBoardPage } from '@/components/pages/ApplicationsBoardPage';

export const metadata: Metadata = {
  title: 'Applications | Planning Tracker',
  description: 'Column view of every application grouped by status.',
};

export default function ApplicationsRoute() {
  return <ApplicationsBoardPage />;
}
