'use client';

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  type FormEvent,
} from 'react';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useSWRConfig } from 'swr';
import { BreadcrumbNav } from '@/components/BreadcrumbNav';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useNavigation, buildBreadcrumbs } from '@/contexts/NavigationContext';
import { fetchApplication, SWR_KEYS, updateApplication, type ApplicationAggregateDto } from '@/lib/api';
import { routes } from '@/lib/navigation';
import { refreshApplicationCaches } from '@/lib/applicationCache';
import { useAppNavigation } from '@/lib/useAppNavigation';
import { ApplicationExtensionsPanel } from '@/components/ApplicationExtensionsPanel';

interface Props {
  applicationId: string;
}

const OUTCOME_OPTIONS = ['Approved', 'Refused', 'Withdrawn', 'Pending', 'NotApplicable'] as const;

interface DraftField {
  value: string;
  required?: boolean;
  type?: 'date' | 'string';
}

interface CoreDraft {
  prjCodeName: DraftField;
  ppReference: DraftField;
  lpaReference: DraftField;
  description: DraftField;
  council: DraftField;
  submissionDate: DraftField;
  validationDate: DraftField;
  determinationDate: DraftField;
  outcome: DraftField;
  caseOfficer: DraftField;
  caseOfficerEmail: DraftField;
  planningPortalUrl: DraftField;
  notes: DraftField;
}

export function ApplicationEditPage({ applicationId }: Props) {
  const pathname = usePathname();
  const { dispatch } = useNavigation();
  const { goBack } = useAppNavigation();
  const { data, error, isLoading, mutate } = useSWR<ApplicationAggregateDto>(
    SWR_KEYS.applicationAggregate(applicationId),
    () => fetchApplication(applicationId)
  );

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: isLoading });
  }, [dispatch, isLoading]);

  useEffect(() => {
    if (data) {
      dispatch({ type: 'SET_APPLICATION', payload: data.application });
      const crumbs = buildBreadcrumbs(data.application, pathname);
      dispatch({ type: 'SET_BREADCRUMBS', payload: crumbs });
    }
    if (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
    return () => {
      dispatch({ type: 'SET_BREADCRUMBS', payload: [] });
    };
  }, [dispatch, data, error, pathname]);

  if (isLoading) {
    return (
      <div style={pageShell}>
        <BreadcrumbNav />
        <div style={centered}>
          <LoadingSpinner size="lg" message="Loading application…" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={pageShell}>
        <BreadcrumbNav />
        <div style={errorCard}>
          <h1 style={{ margin: 0 }}>Unable to load application</h1>
          <p style={{ margin: '8px 0 16px', color: 'var(--text-muted)' }}>{error?.message ?? 'Unknown error.'}</p>
          <button type="button" style={primaryButton} onClick={goBack}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageShell}>
      <BreadcrumbNav />
      <ApplicationEditForm applicationId={applicationId} aggregate={data} onUpdated={mutate} />
      <ApplicationExtensionsPanel
        applicationId={applicationId}
        aggregate={data}
        onUpdated={mutate}
        title="Extensions of time"
        description="Capture new extensions or adjust existing agreements directly from the edit view."
      />
    </div>
  );
}

interface FormProps {
  applicationId: string;
  aggregate: ApplicationAggregateDto;
  onUpdated: () => Promise<any>;
}

function ApplicationEditForm({ applicationId, aggregate, onUpdated }: FormProps) {
  const { mutate: globalMutate } = useSWRConfig();
  const [draft, setDraft] = useState<CoreDraft>(() => toDraft(aggregate));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(toDraft(aggregate));
  }, [aggregate]);

  const controls = useMemo(() => buildDraftControls(setDraft), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = buildUpdatePayload(draft, aggregate);
      if (Object.keys(payload).length === 0) {
        setMessage('No changes to save.');
      } else {
        await updateApplication(applicationId, payload);
        await Promise.all([
          onUpdated(),
          refreshApplicationCaches(globalMutate, applicationId),
          globalMutate(SWR_KEYS.dashboardOverview),
          globalMutate(SWR_KEYS.calendarApplications()),
          globalMutate(SWR_KEYS.outcomeSummary()),
        ]);
        setMessage('Application updated successfully.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save application');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={formCard}>
      <header style={cardHeader}>
        <div>
          <h1 style={{ margin: '0 0 6px' }}>Edit application</h1>
          <p style={cardSubtitle}>Update core metadata, contact details, and key milestones.</p>
        </div>
      </header>
      <form onSubmit={handleSubmit} style={formLayout}>
        <div style={gridLayout}>
          <EditableField label="Project code & name" required field={draft.prjCodeName} onChange={controls.update('prjCodeName')} />
          <EditableField label="PP reference" required field={draft.ppReference} onChange={controls.update('ppReference')} />
          <EditableField label="LPA reference" field={draft.lpaReference} onChange={controls.update('lpaReference')} />
          <EditableField label="Council" required field={draft.council} onChange={controls.update('council')} />
          <EditableField label="Submission date" required field={draft.submissionDate} onChange={controls.update('submissionDate')} type="date" />
          <EditableField label="Validation date" field={draft.validationDate} onChange={controls.update('validationDate')} type="date" />
          <EditableField label="Determination date" field={draft.determinationDate} onChange={controls.update('determinationDate')} type="date" />
          <EditableSelect
            label="Outcome"
            field={draft.outcome}
            options={OUTCOME_OPTIONS.map((value) => ({ value, label: value }))}
            onChange={controls.update('outcome')}
          />
          <EditableField label="Case officer" field={draft.caseOfficer} onChange={controls.update('caseOfficer')} />
          <EditableField label="Case officer email" field={draft.caseOfficerEmail} onChange={controls.update('caseOfficerEmail')} />
          <EditableField label="Planning portal URL" field={draft.planningPortalUrl} onChange={controls.update('planningPortalUrl')} />
        </div>
        <EditableTextArea label="Description" required field={draft.description} onChange={controls.update('description')} minHeight={140} />
        <EditableTextArea label="Notes" field={draft.notes} onChange={controls.update('notes')} minHeight={120} />
        {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
        {message && <p style={{ color: 'var(--success)', fontSize: 13 }}>{message}</p>}
        <div style={actionsRow}>
          <button type="submit" style={primaryButton} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  );
}

function toDraft(aggregate: ApplicationAggregateDto): CoreDraft {
  const application = aggregate.application;
  return {
    prjCodeName: { value: application.prjCodeName, required: true },
    ppReference: { value: application.ppReference, required: true },
    lpaReference: { value: application.lpaReference ?? '' },
    description: { value: application.description, required: true },
    council: { value: application.council, required: true },
    submissionDate: { value: application.submissionDate, required: true, type: 'date' },
    validationDate: { value: application.validationDate ?? '', type: 'date' },
    determinationDate: { value: application.determinationDate ?? '', type: 'date' },
    outcome: { value: application.outcome ?? 'Pending' },
    caseOfficer: { value: application.caseOfficer ?? '' },
    caseOfficerEmail: { value: application.caseOfficerEmail ?? '' },
    planningPortalUrl: { value: application.planningPortalUrl ?? '' },
    notes: { value: application.notes ?? '' },
  };
}

function buildDraftControls(
  setDraft: Dispatch<SetStateAction<CoreDraft>>
): {
  update: (key: keyof CoreDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
} {
  return {
    update: (key) => (event) => {
      const value = event.target.value;
      setDraft((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          value,
        },
      }));
    },
  };
}

function buildUpdatePayload(draft: CoreDraft, aggregate: ApplicationAggregateDto) {
  const payload: Record<string, unknown> = {};
  const current = aggregate.application as unknown as Record<string, unknown>;

  for (const [key, field] of Object.entries(draft) as [keyof CoreDraft, DraftField][]) {
    const trimmed = typeof field.value === 'string' ? field.value.trim() : field.value;

    if (field.required && !trimmed) {
      throw new Error('All required fields must be completed before saving.');
    }

    const existing = current[key];
    const normalizedExisting = typeof existing === 'string' ? existing : existing ?? '';
    const normalizedNext = trimmed;
    if ((normalizedExisting ?? '') !== (normalizedNext ?? '')) {
      payload[key] = normalizedNext === '' ? null : normalizedNext;
    }
  }

  return payload;
}

interface EditableFieldProps {
  label: string;
  field: DraftField;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: 'date' | 'text';
}

function EditableField({ label, field, onChange, required, type = 'text' }: EditableFieldProps) {
  return (
    <label style={labelStyle}>
      {label}
      <input
        value={field.value}
        onChange={onChange}
        required={required || field.required}
        type={type === 'date' ? 'date' : 'text'}
        style={inputStyle}
      />
    </label>
  );
}

interface EditableSelectProps {
  label: string;
  field: DraftField;
  options: Array<{ value: string; label: string }>;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}

function EditableSelect({ label, field, options, onChange }: EditableSelectProps) {
  return (
    <label style={labelStyle}>
      {label}
      <select value={field.value} onChange={onChange} style={inputStyle}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface EditableTextAreaProps {
  label: string;
  field: DraftField;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
  minHeight?: number;
}

function EditableTextArea({ label, field, onChange, required, minHeight = 120 }: EditableTextAreaProps) {
  return (
    <label style={labelStyle}>
      {label}
      <textarea
        value={field.value}
        onChange={onChange}
        required={required || field.required}
        style={{ ...inputStyle, minHeight, resize: 'vertical' }}
      />
    </label>
  );
}

const pageShell: CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  padding: '32px 24px 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const centered: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '64px 0',
};

const errorCard: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 16,
  background: 'var(--surface)',
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  alignItems: 'flex-start',
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
  margin: 0,
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
