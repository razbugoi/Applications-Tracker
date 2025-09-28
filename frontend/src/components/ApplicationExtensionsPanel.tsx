'use client';

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { format } from 'date-fns';
import { useSWRConfig } from 'swr';
import type { ApplicationAggregateDto, ExtensionDto } from '@/types/application';
import { createExtension, updateExtension, SWR_KEYS } from '@/lib/api';
import { refreshApplicationCaches } from '@/lib/applicationCache';

interface Props {
  applicationId: string;
  aggregate: ApplicationAggregateDto;
  onUpdated?: () => Promise<any>;
  title?: string;
  description?: string;
}

type Mode = 'idle' | 'create' | 'edit';

type ExtensionFormDraft = {
  requestedDate: string;
  agreedDate: string;
  notes: string;
};

export function ApplicationExtensionsPanel({
  applicationId,
  aggregate,
  onUpdated,
  title = 'Extensions of time',
  description = 'Record and update agreed determination extensions.',
}: Props) {
  const { mutate: globalMutate } = useSWRConfig();
  const [mode, setMode] = useState<Mode>('idle');
  const [draft, setDraft] = useState<ExtensionFormDraft>(() => buildDraft());
  const [selected, setSelected] = useState<ExtensionDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isLive = aggregate.application.status === 'Live';
  const extensions = useMemo(
    () => [...(aggregate.extensions ?? [])].sort((left, right) => left.agreedDate.localeCompare(right.agreedDate)),
    [aggregate.extensions]
  );
  const extensionSignature = useMemo(
    () => extensions.map((extension) => extension.updatedAt).join('|'),
    [extensions]
  );

  useEffect(() => {
    setMode('idle');
    setSelected(null);
    setDraft(buildDraft());
    setError(null);
  }, [extensionSignature, aggregate.application.status]);

  function startCreate() {
    if (!isLive || saving) {
      return;
    }
    setMode('create');
    setSelected(null);
    setDraft(buildDraft());
    setError(null);
    setFeedback(null);
  }

  function startEdit(extension: ExtensionDto) {
    if (!isLive || saving) {
      return;
    }
    setMode('edit');
    setSelected(extension);
    setDraft(buildDraft(extension));
    setError(null);
    setFeedback(null);
  }

  function cancelForm() {
    setMode('idle');
    setSelected(null);
    setDraft(buildDraft());
    setError(null);
  }

  function handleFieldChange(field: keyof ExtensionFormDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setDraft((prev) => ({
        ...prev,
        [field]: value,
      }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.agreedDate.trim()) {
      setError('Agreed date is required.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      requestedDate: draft.requestedDate.trim() || null,
      agreedDate: draft.agreedDate,
      notes: draft.notes.trim() || null,
    };

    try {
      if (mode === 'edit' && selected) {
        await updateExtension(applicationId, selected.extensionId, payload);
        setFeedback('Extension updated.');
      } else {
        await createExtension(applicationId, payload);
        setFeedback('Extension created.');
      }

      await Promise.all([
        refreshApplicationCaches(globalMutate, applicationId, { includeIssues: false }),
        globalMutate(SWR_KEYS.dashboardOverview),
        globalMutate(SWR_KEYS.calendarApplications()),
        onUpdated?.(),
      ]);

      setMode('idle');
      setSelected(null);
      setDraft(buildDraft());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save extension');
    } finally {
      setSaving(false);
    }
  }

  const showForm = mode !== 'idle';

  return (
    <section style={extensionsCard}>
      <header style={cardHeader}>
        <div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          <p style={cardSubtitle}>{description}</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          style={{
            ...primaryButton,
            opacity: isLive ? 1 : 0.5,
            cursor: !isLive || saving ? 'not-allowed' : 'pointer',
          }}
          disabled={!isLive || saving}
        >
          Add extension
        </button>
      </header>

      {!isLive && (
        <p style={{ ...emptyState, color: 'var(--text-muted)' }}>
          Extensions can only be managed while the application is live.
        </p>
      )}
      {feedback && <p style={{ color: 'var(--success)', fontSize: 13 }}>{feedback}</p>}

      {extensions.length === 0 ? (
        <p style={emptyState}>No extensions recorded.</p>
      ) : (
        <ul style={extensionList}>
          {extensions.map((extension) => {
            const isEditing = mode === 'edit' && selected?.extensionId === extension.extensionId;
            return (
              <li
                key={extension.extensionId}
                style={{
                  ...extensionItem,
                  borderColor: isEditing ? 'var(--primary)' : 'var(--border)',
                }}
              >
                <div style={extensionInfo}>
                  <span style={extensionPrimary}>{formatIsoDate(extension.agreedDate)}</span>
                  <span style={extensionLabel}>Agreed determination date</span>
                  {extension.requestedDate && (
                    <span style={extensionMeta}>Requested {formatIsoDate(extension.requestedDate)}</span>
                  )}
                  {extension.notes && <p style={extensionNotes}>{extension.notes}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(extension)}
                  style={{
                    ...tertiaryButton,
                    cursor: !isLive || saving ? 'not-allowed' : 'pointer',
                    opacity: !isLive || saving ? 0.5 : 1,
                  }}
                  disabled={!isLive || saving}
                >
                  Edit
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={extensionForm}>
          <div style={formGrid}>
            <label style={labelStyle}>
              Requested date
              <input
                type="date"
                value={draft.requestedDate}
                onChange={handleFieldChange('requestedDate')}
                style={inputStyle}
                disabled={saving}
              />
            </label>
            <label style={labelStyle}>
              Agreed date
              <input
                type="date"
                value={draft.agreedDate}
                onChange={handleFieldChange('agreedDate')}
                style={inputStyle}
                required
                disabled={saving}
              />
            </label>
          </div>
          <label style={labelStyle}>
            Notes
            <textarea
              value={draft.notes}
              onChange={handleFieldChange('notes')}
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
              disabled={saving}
            />
          </label>
          {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
          <div style={extensionActions}>
            <button type="button" onClick={cancelForm} style={{ ...ghostButton, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              Cancel
            </button>
            <button type="submit" style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create extension'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function buildDraft(extension?: ExtensionDto | null): ExtensionFormDraft {
  return {
    requestedDate: extension?.requestedDate ?? '',
    agreedDate: extension?.agreedDate ?? '',
    notes: extension?.notes ?? '',
  };
}

function formatIsoDate(value?: string | null) {
  if (!value) {
    return '—';
  }
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch (error) {
    return value;
  }
}

const extensionsCard: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 16,
  border: '1px solid var(--border)',
  padding: 32,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
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

const emptyState: CSSProperties = {
  margin: 0,
  color: 'var(--text-muted)',
};

const extensionList: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const extensionItem: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  gap: 16,
  justifyContent: 'space-between',
  alignItems: 'flex-start',
};

const extensionInfo: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flex: '1 1 auto',
};

const extensionPrimary: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
};

const extensionLabel: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

const extensionMeta: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
};

const extensionNotes: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 13,
  lineHeight: 1.4,
};

const extensionForm: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  borderTop: '1px solid var(--border)',
  paddingTop: 16,
  marginTop: 8,
};

const formGrid: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  color: 'var(--text-muted)',
  flex: '1 1 220px',
};

const inputStyle: CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--border)',
  padding: '10px 12px',
  fontSize: 14,
};

const extensionActions: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
};

const primaryButton: CSSProperties = {
  background: 'var(--primary)',
  border: 'none',
  color: '#fff',
  borderRadius: 999,
  fontWeight: 600,
  padding: '10px 18px',
};

const ghostButton: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
  borderRadius: 999,
  padding: '10px 18px',
  fontWeight: 600,
};

const tertiaryButton: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--primary)',
  fontWeight: 600,
  padding: '6px 12px',
};
