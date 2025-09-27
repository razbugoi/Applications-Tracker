import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApplicationTimelinePage } from '@/components/pages/ApplicationTimelinePage';
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
      title: `${application.prjCodeName} Timeline | Planning Tracker`,
      description: `Timeline of stage progression for ${application.prjCodeName}.`,
      openGraph: {
        title: `${application.prjCodeName} Timeline`,
        description: `Timeline of stage progression for ${application.prjCodeName}.`,
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

export default function ApplicationTimelineRoute({ params }: PageProps) {
  if (!isValidApplicationId(params.id)) {
    notFound();
  }

  return <ApplicationTimelinePage applicationId={params.id} />;
}
