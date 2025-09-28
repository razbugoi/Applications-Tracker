import { createSupabaseServiceRoleClient } from '@/lib/supabaseServerClient';
import type {
  Application,
  ApplicationAggregate,
  ApplicationStatus,
  ExtensionOfTime,
  Issue,
  TimelineEvent,
} from '../models/application';

const DEFAULT_TEAM_ID = process.env.SUPABASE_DEFAULT_TEAM_ID ?? '00000000-0000-0000-0000-000000000001';

function mapApplicationRow(row: any): Application {
  return {
    applicationId: row.id,
    prjCodeName: row.prj_code_name,
    ppReference: row.pp_reference,
    lpaReference: row.lpa_reference,
    description: row.description,
    council: row.council,
    submissionDate: row.submission_date,
    validationDate: row.validation_date,
    determinationDate: row.determination_date,
    eotDate: row.eot_date,
    status: row.status,
    outcome: row.outcome,
    notes: row.notes,
    issuesCount: row.issues_count ?? 0,
    caseOfficer: row.case_officer,
    caseOfficerEmail: row.case_officer_email,
    planningPortalUrl: row.planning_portal_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIssueRow(row: any): Issue {
  return {
    issueId: row.id ?? row.issue_id ?? row.issueId,
    applicationId: row.application_id ?? row.applicationId,
    ppReference: row.pp_reference,
    lpaReference: row.lpa_reference,
    prjCodeName: row.prj_code_name,
    title: row.title,
    category: row.category,
    description: row.description,
    raisedBy: row.raised_by,
    dateRaised: row.date_raised,
    assignedTo: row.assigned_to,
    status: row.status,
    dueDate: row.due_date,
    resolutionNotes: row.resolution_notes,
    dateResolved: row.date_resolved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTimelineRow(row: any): TimelineEvent {
  return {
    eventId: row.id,
    applicationId: row.application_id,
    timestamp: row.occurred_at ?? row.timestamp ?? row.created_at,
    stage: row.stage,
    event: row.event,
    details: row.details,
    durationDays: row.duration_days,
  };
}

function mapExtensionRow(row: any): ExtensionOfTime {
  return {
    extensionId: row.id ?? row.extension_id,
    applicationId: row.application_id,
    ppReference: row.pp_reference,
    prjCodeName: row.prj_code_name,
    requestedDate: row.requested_date,
    agreedDate: row.agreed_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseRepository {
  private clientFactory() {
    const client = createSupabaseServiceRoleClient();
    return client;
  }

  async createApplication(application: Application): Promise<void> {
    const supabase = this.clientFactory();
    console.log('[SupabaseRepository] using client', {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      keyPrefix: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').slice(0, 10),
    });
    const { error } = await supabase
      .from('applications')
      .insert({
        id: application.applicationId,
        team_id: DEFAULT_TEAM_ID,
        prj_code_name: application.prjCodeName,
        pp_reference: application.ppReference,
        lpa_reference: application.lpaReference,
        description: application.description,
        council: application.council,
        submission_date: application.submissionDate,
        validation_date: application.validationDate,
        determination_date: application.determinationDate,
        eot_date: application.eotDate,
        status: application.status,
        outcome: application.outcome ?? 'Pending',
        notes: application.notes,
        issues_count: application.issuesCount ?? 0,
        case_officer: application.caseOfficer,
        case_officer_email: application.caseOfficerEmail,
        planning_portal_url: application.planningPortalUrl,
        created_at: application.createdAt,
        updated_at: application.updatedAt,
      });
    if (error) {
      throw new Error(`Failed to insert application: ${error.message}`);
    }
  }

  async listApplicationsByStatus(status: ApplicationStatus, limit = 50, _next?: Record<string, string>) {
    const supabase = this.clientFactory();
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('status', status)
      .order('submission_date', { ascending: false })
      .limit(limit);
    if (error) {
      throw new Error(`Failed to list applications: ${error.message}`);
    }
    const applications = (data ?? []).map(mapApplicationRow);
    return { items: applications, next: undefined };
  }

  async getApplicationAggregate(applicationId: string): Promise<ApplicationAggregate | null> {
    const supabase = this.clientFactory();
    const { data, error } = await supabase
      .from('applications')
      .select(
        `*,
        issues (*),
        timeline_events (*),
        extensions_of_time (*)`
      )
      .eq('id', applicationId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch application: ${error.message}`);
    }
    if (!data) {
      return null;
    }
    const application = mapApplicationRow(data);
    const issues = (data.issues ?? []).map(mapIssueRow);
    const timeline = (data.timeline_events ?? [])
      .map(mapTimelineRow)
      .sort((a: TimelineEvent, b: TimelineEvent) => a.timestamp.localeCompare(b.timestamp));
    const extensions = (data.extensions_of_time ?? [])
      .map(mapExtensionRow)
      .sort((a: ExtensionOfTime, b: ExtensionOfTime) => a.agreedDate.localeCompare(b.agreedDate));

    return { application, issues, timeline, extensions };
  }

  async updateApplication(applicationId: string, attributes: Partial<Application>, current?: Application): Promise<void> {
    const supabase = this.clientFactory();
    let snapshot = current;
    if (!snapshot) {
      const aggregate = await this.getApplicationAggregate(applicationId);
      if (!aggregate) {
        throw new Error('Application not found');
      }
      snapshot = aggregate.application;
    }

    const payload: Record<string, unknown> = {};
    const mappings: Record<keyof Application, string> = {
      applicationId: 'id',
      prjCodeName: 'prj_code_name',
      ppReference: 'pp_reference',
      lpaReference: 'lpa_reference',
      description: 'description',
      council: 'council',
      submissionDate: 'submission_date',
      validationDate: 'validation_date',
      determinationDate: 'determination_date',
      eotDate: 'eot_date',
      status: 'status',
      outcome: 'outcome',
      planningPortalUrl: 'planning_portal_url',
      notes: 'notes',
      issuesCount: 'issues_count',
      caseOfficer: 'case_officer',
      caseOfficerEmail: 'case_officer_email',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    } as const;

    (Object.keys(attributes) as (keyof Application)[]).forEach((key) => {
      if (key === 'applicationId' || key === 'createdAt' || key === 'updatedAt') {
        return;
      }
      const column = mappings[key];
      if (!column) {
        return;
      }
      const value = attributes[key];
      if (value === undefined) {
        return;
      }
      payload[column] = value;
    });

    if (Object.keys(payload).length === 0) {
      return;
    }

    const { error } = await supabase.from('applications').update(payload).eq('id', applicationId);
    if (error) {
      throw new Error(`Failed to update application: ${error.message}`);
    }
  }

  async putTimelineEvent(event: TimelineEvent): Promise<void> {
    const supabase = this.clientFactory();
    const { error } = await supabase.from('timeline_events').insert({
      id: event.eventId,
      application_id: event.applicationId,
      stage: event.stage,
      event: event.event,
      details: event.details,
      occurred_at: event.timestamp,
      duration_days: event.durationDays ?? null,
      created_at: event.timestamp,
    });
    if (error) {
      throw new Error(`Failed to insert timeline event: ${error.message}`);
    }
  }

  async listIssues(status?: Issue['status']): Promise<Issue[]> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    const endpoint = new URL('/rest/v1/issues', url);
    endpoint.searchParams.set('select', '*,application:applications(prj_code_name,pp_reference,lpa_reference)');
    if (status) {
      endpoint.searchParams.set('status', `eq.${status}`);
    }

    const response = await fetch(endpoint, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'count=exact',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to list issues: ${response.status} ${message}`);
    }

    const rows = ((await response.json()) as any[]) ?? [];
    const enriched = rows.map((row) => {
      const issue = mapIssueRow(row);
      if (row.application) {
        issue.prjCodeName = row.application.prj_code_name;
        issue.ppReference = row.application.pp_reference;
        issue.lpaReference = row.application.lpa_reference;
      }
      return issue;
    });

    const statusOrder: Issue['status'][] = ['Open', 'In Progress', 'Resolved', 'Closed'];
    enriched.sort((left, right) => {
      const statusDelta = statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status);
      if (statusDelta !== 0) {
        return statusDelta;
      }
      const dueLeft = left.dueDate ?? '9999-12-31';
      const dueRight = right.dueDate ?? '9999-12-31';
      const dueCompare = dueLeft.localeCompare(dueRight);
      if (dueCompare !== 0) {
        return dueCompare;
      }
      const nameLeft = left.prjCodeName ?? '';
      const nameRight = right.prjCodeName ?? '';
      return nameLeft.localeCompare(nameRight, undefined, { numeric: true, sensitivity: 'base' });
    });

    return enriched;
  }

  async createIssue(issue: Issue): Promise<void> {
    const supabase = this.clientFactory();
    const { error } = await supabase.from('issues').insert({
      id: issue.issueId,
      application_id: issue.applicationId,
      pp_reference: issue.ppReference,
      prj_code_name: issue.prjCodeName,
      lpa_reference: issue.lpaReference,
      title: issue.title,
      category: issue.category,
      description: issue.description,
      raised_by: issue.raisedBy,
      date_raised: issue.dateRaised,
      assigned_to: issue.assignedTo,
      status: issue.status,
      due_date: issue.dueDate,
      resolution_notes: issue.resolutionNotes,
      date_resolved: issue.dateResolved,
      created_at: issue.createdAt,
      updated_at: issue.updatedAt,
    });
    if (error) {
      throw new Error(`Failed to insert issue: ${error.message}`);
    }
  }

  async createExtension(extension: ExtensionOfTime): Promise<void> {
    const supabase = this.clientFactory();
    const { error } = await supabase.from('extensions_of_time').insert({
      id: extension.extensionId,
      application_id: extension.applicationId,
      pp_reference: extension.ppReference,
      prj_code_name: extension.prjCodeName,
      requested_date: extension.requestedDate,
      agreed_date: extension.agreedDate,
      notes: extension.notes,
      created_at: extension.createdAt,
      updated_at: extension.updatedAt,
    });
    if (error) {
      throw new Error(`Failed to insert extension: ${error.message}`);
    }
  }

  async getExtension(applicationId: string, extensionId: string): Promise<ExtensionOfTime | null> {
    const supabase = this.clientFactory();
    const { data, error } = await supabase
      .from('extensions_of_time')
      .select('*')
      .eq('application_id', applicationId)
      .eq('id', extensionId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch extension: ${error.message}`);
    }
    if (!data) {
      return null;
    }
    return mapExtensionRow(data);
  }

  async updateExtension(extension: ExtensionOfTime): Promise<void> {
    const supabase = this.clientFactory();
    const { error } = await supabase
      .from('extensions_of_time')
      .update({
        requested_date: extension.requestedDate,
        agreed_date: extension.agreedDate,
        notes: extension.notes,
        updated_at: extension.updatedAt,
      })
      .eq('id', extension.extensionId)
      .eq('application_id', extension.applicationId);
    if (error) {
      throw new Error(`Failed to update extension: ${error.message}`);
    }
  }

  async refreshApplicationExtensionDate(applicationId: string): Promise<void> {
    const supabase = this.clientFactory();
    const { data, error } = await supabase
      .from('extensions_of_time')
      .select('agreed_date')
      .eq('application_id', applicationId)
      .order('agreed_date', { ascending: false })
      .limit(1);
    if (error) {
      throw new Error(`Failed to determine latest extension: ${error.message}`);
    }
    const latest = data && data.length > 0 ? data[0]?.agreed_date ?? null : null;
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        eot_date: latest,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);
    if (updateError) {
      throw new Error(`Failed to sync application extension date: ${updateError.message}`);
    }
  }

  async getIssue(applicationId: string, issueId: string): Promise<Issue | null> {
    const supabase = this.clientFactory();
    const { data, error } = await supabase
      .from('issues')
      .select('*, application:applications (prj_code_name, pp_reference, lpa_reference)')
      .eq('application_id', applicationId)
      .eq('id', issueId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch issue: ${error.message}`);
    }
    if (!data) {
      return null;
    }
    const issue = mapIssueRow(data);
    if (data.application) {
      issue.prjCodeName = data.application.prj_code_name;
      issue.ppReference = data.application.pp_reference;
      issue.lpaReference = data.application.lpa_reference;
    }
    return issue;
  }

  async updateIssue(issue: Issue): Promise<void> {
    const supabase = this.clientFactory();
    const { error } = await supabase
      .from('issues')
      .update({
        title: issue.title,
        category: issue.category,
        description: issue.description,
        raised_by: issue.raisedBy,
        date_raised: issue.dateRaised,
        assigned_to: issue.assignedTo,
        status: issue.status,
        due_date: issue.dueDate,
        resolution_notes: issue.resolutionNotes,
        date_resolved: issue.dateResolved,
        updated_at: issue.updatedAt,
      })
      .eq('id', issue.issueId)
      .eq('application_id', issue.applicationId);
    if (error) {
      throw new Error(`Failed to update issue: ${error.message}`);
    }
  }

  async deleteIssue(applicationId: string, issueId: string): Promise<void> {
    const supabase = this.clientFactory();
    const { error } = await supabase.from('issues').delete().eq('id', issueId).eq('application_id', applicationId);
    if (error) {
      throw new Error(`Failed to delete issue: ${error.message}`);
    }
  }
}
