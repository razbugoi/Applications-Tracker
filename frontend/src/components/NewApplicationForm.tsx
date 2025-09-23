'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
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

  const updateField = (field: keyof typeof initialState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

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
                <input required value={form.prjCodeName} onChange={updateField('prjCodeName')} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                PP Reference
                <input required value={form.ppReference} onChange={updateField('ppReference')} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                LPA Reference
                <input value={form.lpaReference} onChange={updateField('lpaReference')} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Council
                <input required value={form.council} onChange={updateField('council')} style={inputStyle} />
              </label>
        <label style={labelStyle}>
          Case Officer
          <input value={form.caseOfficer} onChange={updateField('caseOfficer')} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Case Officer Email
          <input type="email" value={form.caseOfficerEmail} onChange={updateField('caseOfficerEmail')} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Planning Portal URL
          <input value={form.planningPortalUrl} onChange={updateField('planningPortalUrl')} style={inputStyle} />
        </label>
              <label style={labelStyle}>
                Submission Date
                <input required type="date" value={form.submissionDate} onChange={updateField('submissionDate')} style={inputStyle} />
              </label>
            </div>
            <label style={labelStyle}>
              Description
              <textarea
                required
                value={form.description}
                onChange={updateField('description')}
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
