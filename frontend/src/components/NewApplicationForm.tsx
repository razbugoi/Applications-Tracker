'use client';

import { useState, useCallback, useEffect, type ChangeEvent, type FormEvent } from 'react';
import type { CSSProperties } from 'react';
import { createApplication, type ApplicationDto } from '@/lib/api';
import { Modal } from './Modal';

interface Props {
  onCreated: (application: ApplicationDto) => void;
}

const initialState = {
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

export function NewApplicationForm({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setForm(initialState);
      setError(null);
    }
  }, [open]);

  // Create stable update handlers for each field to prevent focus loss
  const updatePrjCodeName = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, prjCodeName: event.target.value }));
  }, []);

  const updatePpReference = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, ppReference: event.target.value }));
  }, []);

  const updateLpaReference = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, lpaReference: event.target.value }));
  }, []);

  const updateDescription = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, description: event.target.value }));
  }, []);

  const updateCouncil = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, council: event.target.value }));
  }, []);

  const updateSubmissionDate = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, submissionDate: event.target.value }));
  }, []);

  const updateCaseOfficer = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, caseOfficer: event.target.value }));
  }, []);

  const updateCaseOfficerEmail = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, caseOfficerEmail: event.target.value }));
  }, []);

  const updatePlanningPortalUrl = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, planningPortalUrl: event.target.value }));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...form,
        submissionDate: form.submissionDate,
        planningPortalUrl: form.planningPortalUrl.trim() || undefined,
        caseOfficerEmail: form.caseOfficerEmail.trim() || undefined,
      };
      const created = await createApplication(payload);
      onCreated(created);
      setForm(initialState);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create application');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" style={primaryButton} onClick={() => setOpen(true)}>
        + New Application
      </button>
      {open && (
        <Modal title="New Application" onClose={() => (loading ? undefined : setOpen(false))} size="lg">
          <form onSubmit={handleSubmit} style={formStyle}>
            <div style={formGrid}>
              <label style={labelStyle}>
                Project Code & Name
                <input required value={form.prjCodeName} onChange={updatePrjCodeName} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                PP Reference
                <input required value={form.ppReference} onChange={updatePpReference} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                LPA Reference
                <input value={form.lpaReference} onChange={updateLpaReference} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Council
                <input required value={form.council} onChange={updateCouncil} style={inputStyle} />
              </label>
        <label style={labelStyle}>
          Case Officer
          <input value={form.caseOfficer} onChange={updateCaseOfficer} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Case Officer Email
          <input type="email" value={form.caseOfficerEmail} onChange={updateCaseOfficerEmail} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Planning Portal URL
          <input value={form.planningPortalUrl} onChange={updatePlanningPortalUrl} style={inputStyle} />
        </label>
              <label style={labelStyle}>
                Submission Date
                <input required type="date" value={form.submissionDate} onChange={updateSubmissionDate} style={inputStyle} />
              </label>
            </div>
            <label style={labelStyle}>
              Description
              <textarea
                required
                value={form.description}
                onChange={updateDescription}
                style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
              />
            </label>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" style={secondaryButton} onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </button>
              <button type="submit" style={primaryButton} disabled={loading}>
                {loading ? 'Saving…' : 'Save Application'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

const primaryButton: CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 999,
  padding: '10px 18px',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButton: CSSProperties = {
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '10px 18px',
  fontWeight: 600,
  cursor: 'pointer',
};

const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const formGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 14,
};
