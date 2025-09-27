'use client';

import { useState, useEffect, useMemo, type CSSProperties, type ChangeEvent, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { BreadcrumbNav } from '@/components/BreadcrumbNav';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useNavigation } from '@/contexts/NavigationContext';
import { createApplication, SWR_KEYS, type ApplicationDto } from '@/lib/api';
import { routes } from '@/lib/navigation';
import { useAppNavigation } from '@/lib/useAppNavigation';
import { APPLICATION_STATUSES } from '@/lib/applicationConstants';

interface FormState {
  prjCodeName: string;
  ppReference: string;
  lpaReference: string;
  description: string;
  council: string;
  submissionDate: string;
  caseOfficer: string;
  caseOfficerEmail: string;
  planningPortalUrl: string;
}

const initialState: FormState = {
  prjCodeName: '',
  ppReference: '',
  lpaReference: '',
  description: '',
  council: '',
  submissionDate: '',
  caseOfficer: '',
  caseOfficerEmail: '',
  planningPortalUrl: '',
};

export function ApplicationCreatePage() {
  const pathname = usePathname();
  const { dispatch } = useNavigation();
  const { mutate: globalMutate } = useSWRConfig();
  const { goToApplication } = useAppNavigation();
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ApplicationDto | null>(null);

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, [dispatch, loading]);

  useEffect(() => {
    dispatch({
      type: 'SET_BREADCRUMBS',
      payload: [
        { label: 'Dashboard', href: routes.dashboard, isActive: false },
        { label: 'New Application', href: routes.applications.new, isActive: true },
      ],
    });
    dispatch({ type: 'CLEAR_APPLICATION' });
    return () => {
      dispatch({ type: 'SET_BREADCRUMBS', payload: [] });
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_ERROR', payload: null });
    };
  }, [dispatch, pathname]);

  const controls = useMemo(() => buildControls(setForm), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (!form.submissionDate) {
        throw new Error('Submission date is required');
      }
      const payload = {
        ...form,
        planningPortalUrl: form.planningPortalUrl.trim() || undefined,
        caseOfficerEmail: form.caseOfficerEmail.trim() || undefined,
        submissionDate: form.submissionDate,
      };
      const created = await createApplication(payload);
      setSuccess(created);
      await Promise.all([
        ...APPLICATION_STATUSES.map((status) => globalMutate(SWR_KEYS.applicationsByStatus(status))),
        globalMutate(SWR_KEYS.dashboardOverview),
        globalMutate(SWR_KEYS.calendarApplications()),
        globalMutate(SWR_KEYS.outcomeSummary()),
      ]);
      goToApplication(created.applicationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create application');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageShell}>
      <BreadcrumbNav />
      <section style={formCard}>
        <header style={cardHeader}>
          <div>
            <h1 style={{ margin: 0 }}>New application</h1>
            <p style={cardSubtitle}>Capture a new planning application and route it through the tracker.</p>
          </div>
        </header>
        <form onSubmit={handleSubmit} style={formLayout}>
          <div style={gridLayout}>
            <label style={labelStyle}>
              Project code & name
              <input required value={form.prjCodeName} onChange={controls.updatePrjCodeName} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              PP reference
              <input required value={form.ppReference} onChange={controls.updatePpReference} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              LPA reference
              <input value={form.lpaReference} onChange={controls.updateLpaReference} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Council
              <input required value={form.council} onChange={controls.updateCouncil} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Case officer
              <input value={form.caseOfficer} onChange={controls.updateCaseOfficer} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Case officer email
              <input type="email" value={form.caseOfficerEmail} onChange={controls.updateCaseOfficerEmail} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Planning portal URL
              <input value={form.planningPortalUrl} onChange={controls.updatePlanningPortalUrl} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Submission date
              <input required type="date" value={form.submissionDate} onChange={controls.updateSubmissionDate} style={inputStyle} />
            </label>
          </div>
          <label style={labelStyle}>
            Description
            <textarea
              required
              value={form.description}
              onChange={controls.updateDescription}
              style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }}
            />
          </label>
          {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
          {loading && (
            <div style={{ padding: '12px 0' }}>
              <LoadingSpinner size="sm" message="Creating application…" />
            </div>
          )}
          <div style={actionsRow}>
            <button type="submit" style={primaryButton} disabled={loading}>
              {loading ? 'Saving…' : 'Save and view application'}
            </button>
          </div>
        </form>
        {success && (
          <p style={{ marginTop: 12, color: 'var(--success)' }}>
            Created {success.prjCodeName}. Redirecting to the detailed view…
          </p>
        )}
      </section>
    </div>
  );
}

function buildControls(setForm: (value: FormState | ((prev: FormState) => FormState)) => void) {
  return {
    updatePrjCodeName: (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, prjCodeName: event.target.value })),
    updatePpReference: (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, ppReference: event.target.value })),
    updateLpaReference: (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, lpaReference: event.target.value })),
    updateDescription: (event: ChangeEvent<HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, description: event.target.value })),
    updateCouncil: (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, council: event.target.value })),
    updateSubmissionDate: (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, submissionDate: event.target.value })),
    updateCaseOfficer: (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, caseOfficer: event.target.value })),
    updateCaseOfficerEmail: (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, caseOfficerEmail: event.target.value })),
    updatePlanningPortalUrl: (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, planningPortalUrl: event.target.value })),
  } satisfies Record<string, (event: any) => void>;
}

const pageShell: CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  padding: '32px 24px 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const formCard: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 16,
  border: '1px solid var(--border)',
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const cardHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
};

const cardSubtitle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--text-muted)',
};

const formLayout: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const gridLayout: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  color: 'var(--text-muted)',
};

const inputStyle: CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--border)',
  padding: '10px 12px',
  fontSize: 14,
};

const actionsRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
};

const primaryButton: CSSProperties = {
  background: 'var(--primary)',
  border: 'none',
  color: '#fff',
  borderRadius: 999,
  fontWeight: 600,
  padding: '12px 22px',
  cursor: 'pointer',
};
