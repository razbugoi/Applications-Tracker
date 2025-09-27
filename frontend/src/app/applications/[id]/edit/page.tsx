import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApplicationEditPage } from '@/components/pages/ApplicationEditPage';
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
      title: `Edit ${application.prjCodeName} | Planning Tracker`,
      description: `Update metadata and key details for ${application.prjCodeName}.`,
      openGraph: {
        title: `Edit ${application.prjCodeName}`,
        description: `Update metadata and key details for ${application.prjCodeName}.`,
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

export default function ApplicationEditRoute({ params }: PageProps) {
  if (!isValidApplicationId(params.id)) {
    notFound();
  }

  return <ApplicationEditPage applicationId={params.id} />;
}
