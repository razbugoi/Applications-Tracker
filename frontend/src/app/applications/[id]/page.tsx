import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApplicationDetailPage } from '@/components/pages/ApplicationDetailPage';
import { isValidApplicationId } from '@/lib/navigation';
import { fetchApplication } from '@/lib/api';

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isValidApplicationId(params.id)) {
    return {
      title: 'Application Not Found | Planning Tracker',
      description: 'Unable to locate the requested planning application.',
    };
  }

  try {
    const aggregate = await fetchApplication(params.id);
    const application = aggregate.application;
    return {
      title: `${application.prjCodeName} | Planning Tracker`,
      description: application.description ?? 'Detailed view of the planning application.',
      openGraph: {
        title: application.prjCodeName,
        description: application.description ?? 'Detailed view of the planning application.',
        type: 'website',
      },
    };
  } catch (error) {
    return {
      title: 'Application Not Found | Planning Tracker',
      description: 'Unable to locate the requested planning application.',
    };
  }
}

export default function ApplicationPage({ params }: PageProps) {
  if (!isValidApplicationId(params.id)) {
    notFound();
  }

  return <ApplicationDetailPage applicationId={params.id} />;
}