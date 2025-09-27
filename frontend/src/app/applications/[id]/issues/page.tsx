import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApplicationIssuesPage } from '@/components/pages/ApplicationIssuesPage';
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
      title: `${application.prjCodeName} Issues | Planning Tracker`,
      description: `Issue log for ${application.prjCodeName}.`,
      openGraph: {
        title: `${application.prjCodeName} Issues`,
        description: `Issue log for ${application.prjCodeName}.`,
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

export default function ApplicationIssuesRoute({ params }: PageProps) {
  if (!isValidApplicationId(params.id)) {
    notFound();
  }

  return <ApplicationIssuesPage applicationId={params.id} />;
}
