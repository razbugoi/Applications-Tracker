import type { Metadata } from 'next';
import { ApplicationCreatePage } from '@/components/pages/ApplicationCreatePage';

export const metadata: Metadata = {
  title: 'New Application | Planning Tracker',
  description: 'Create a new planning application entry.',
};

export default function NewApplicationRoute() {
  return <ApplicationCreatePage />;
}
