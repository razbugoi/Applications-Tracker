import { v4 as uuid } from 'uuid';
import { DynamoRepository } from '../repositories/dynamoRepository.js';
const repository = new DynamoRepository();
function nowIso() {
    return new Date().toISOString();
}
function assertDateOrder({ submissionDate, validationDate, determinationDate }) {
    if (submissionDate && validationDate && submissionDate > validationDate) {
        throw new Error('Validation date cannot precede submission date');
    }
    if (validationDate && determinationDate && validationDate > determinationDate) {
        throw new Error('Determination date cannot precede validation date');
    }
}
function buildTimelineEvent(applicationId, stage, event, details) {
    return {
        eventId: uuid(),
        applicationId,
        timestamp: nowIso(),
        stage,
        event,
        details,
    };
}
export async function createApplication(input) {
    const applicationId = uuid();
    const now = nowIso();
    const application = {
        applicationId,
        prjCodeName: input.prjCodeName,
        ppReference: input.ppReference,
        lpaReference: input.lpaReference,
        description: input.description,
        council: input.council,
        submissionDate: input.submissionDate,
        validationDate: input.validationDate,
        caseOfficer: input.caseOfficer,
        determinationDate: input.determinationDate,
        eotDate: input.eotDate,
        status: input.validationDate ? 'Live' : 'Submitted',
        outcome: 'Pending',
        notes: input.notes,
        issuesCount: 0,
        createdAt: now,
        updatedAt: now,
    };
    assertDateOrder(application);
    await repository.createApplication(application);
    await repository.putTimelineEvent(buildTimelineEvent(application.applicationId, application.status, application.status === 'Live' ? 'Validated' : 'Submitted'));
    return application;
}
export async function listApplications(status, limit = 25, next) {
    return repository.listApplicationsByStatus(status, limit, next);
}
export async function getApplication(applicationId) {
    return repository.getApplicationAggregate(applicationId);
}
export async function patchApplication(applicationId, updates) {
    const aggregate = await repository.getApplicationAggregate(applicationId);
    if (!aggregate) {
        throw new Error('Application not found');
    }
    const { application, issues } = aggregate;
    const nextStatus = updates.status ?? application.status;
    if (nextStatus === 'Live') {
        const unresolved = issues.filter((issue) => issue.status !== 'Resolved' && issue.status !== 'Closed');
        if (unresolved.length > 0) {
            throw new Error('Cannot mark application as Live while issues remain open');
        }
        if (!updates.validationDate && !application.validationDate) {
            throw new Error('Validation date required when moving to Live');
        }
    }
    if (nextStatus === 'Determined') {
        if (!updates.outcome && !application.outcome) {
            throw new Error('Outcome required to mark application as Determined');
        }
        if (!updates.determinationDate && !application.determinationDate) {
            throw new Error('Determination date required when marking as Determined');
        }
    }
    const merged = {
        ...application,
        ...updates,
        status: nextStatus,
    };
    assertDateOrder(merged);
    await repository.updateApplication(applicationId, {
        ...updates,
        status: nextStatus,
    }, application);
    if (updates.status && updates.status !== application.status) {
        const eventNameMap = {
            Submitted: 'Submitted',
            Invalidated: 'Invalidated',
            Live: application.status === 'Invalidated' ? 'Revalidated' : 'Validated',
            Determined: 'Decision Issued',
        };
        await repository.putTimelineEvent(buildTimelineEvent(applicationId, updates.status, eventNameMap[updates.status]));
    }
}
export async function createIssue(input) {
    const aggregate = await repository.getApplicationAggregate(input.applicationId);
    if (!aggregate) {
        throw new Error('Application not found');
    }
    const now = nowIso();
    const issue = {
        issueId: uuid(),
        applicationId: input.applicationId,
        ppReference: input.ppReference,
        lpaReference: input.lpaReference,
        title: input.title,
        category: input.category,
        description: input.description,
        raisedBy: input.raisedBy,
        dateRaised: input.dateRaised,
        assignedTo: input.assignedTo,
        status: input.status ?? 'Open',
        dueDate: input.dueDate,
        createdAt: now,
        updatedAt: now,
    };
    await repository.createIssue(issue);
    await repository.putTimelineEvent(buildTimelineEvent(input.applicationId, 'Invalidated', `Issue Raised: ${input.title}`, input.description));
    const unresolvedCount = aggregate.issues.filter((it) => it.status !== 'Resolved' && it.status !== 'Closed').length + 1;
    const updates = { issuesCount: unresolvedCount };
    if (aggregate.application.status !== 'Invalidated') {
        updates.status = 'Invalidated';
        await repository.putTimelineEvent(buildTimelineEvent(input.applicationId, 'Invalidated', 'Application Invalidated'));
    }
    await repository.updateApplication(input.applicationId, updates, aggregate.application);
    return issue;
}
export async function updateIssue({ applicationId, issueId, updates }) {
    const existing = await repository.getIssue(applicationId, issueId);
    if (!existing) {
        throw new Error('Issue not found');
    }
    if (updates.status === 'Resolved' && (!updates.resolutionNotes && !existing.resolutionNotes)) {
        throw new Error('Provide resolution notes when resolving an issue');
    }
    if (updates.status === 'Resolved' && (!updates.dateResolved && !existing.dateResolved)) {
        updates.dateResolved = nowIso();
    }
    const merged = {
        ...existing,
        ...updates,
        updatedAt: nowIso(),
    };
    await repository.updateIssue(merged);
    const aggregate = await repository.getApplicationAggregate(applicationId);
    if (!aggregate) {
        return;
    }
    const unresolved = aggregate.issues.filter((issue) => issue.status !== 'Resolved' && issue.status !== 'Closed');
    await repository.updateApplication(applicationId, { issuesCount: unresolved.length }, aggregate.application);
    if (updates.status === 'Resolved') {
        await repository.putTimelineEvent(buildTimelineEvent(applicationId, 'Invalidated', `Issue Resolved: ${existing.title}`, updates.resolutionNotes));
        if (unresolved.length === 0) {
            const validationDate = aggregate.application.validationDate ?? nowIso();
            await repository.updateApplication(applicationId, { status: 'Live', validationDate }, aggregate.application);
            await repository.putTimelineEvent(buildTimelineEvent(applicationId, 'Live', 'Revalidated after issue resolution'));
        }
    }
}
//# sourceMappingURL=applicationService.js.map