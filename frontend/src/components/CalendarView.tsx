'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useMemo, useState, type CSSProperties } from 'react';
import {
  listApplications,
  type ApplicationDto,
} from '@/lib/api';
import { applicationRoute } from '@/lib/routes';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  parseISO,
  isSameMonth,
  isSameDay,
  format,
} from 'date-fns';

const STATUSES: ('Submitted' | 'Invalidated' | 'Live' | 'Determined')[] = [
  'Submitted',
  'Invalidated',
  'Live',
  'Determined',
];

type CalendarEventType = 'Determination' | 'Extension';

interface CalendarEvent {
  id: string;
  application: ApplicationDto;
  date: string;
  type: CalendarEventType;
}

export function CalendarView() {
  const { data, error, isLoading } = useSWR('calendar-apps', fetchApplications);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    (data ?? []).forEach((event) => {
      const dateKey = event.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)?.push(event);
    });
    return map;
  }, [data]);

  const weeks = useMemo(() => buildMonthMatrix(currentMonth, eventsByDay), [currentMonth, eventsByDay]);

  return (
    <main style={layout}>
      <header style={headerStyle}>
        <div style={monthControls}>
          <button type="button" style={navButton} onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}>
            ←
          </button>
          <h1 style={{ margin: 0 }}>{format(currentMonth, 'MMMM yyyy')}</h1>
          <button type="button" style={navButton} onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}>
            →
          </button>
        </div>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 16 }}>
          Determination dates and extensions mapped on a monthly calendar.
        </p>
        <div style={legendRow}>
          <LegendChip color='rgba(59, 130, 246, 0.15)' border='#1d4ed8' label='Determination due' />
          <LegendChip color='rgba(250, 204, 21, 0.25)' border='#b45309' label='Extension of time' />
        </div>
      </header>

      {isLoading && <p style={messageStyle}>Loading calendar…</p>}
      {error && <p style={{ ...messageStyle, color: 'var(--danger)' }}>Failed to load calendar events.</p>}

      {!isLoading && !error && (
        <section style={calendarShell}>
          <div style={calendarHeaderRow}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((weekday) => (
              <span key={weekday} style={weekdayHeading}>
                {weekday}
              </span>
            ))}
          </div>
          <div style={calendarGrid}>
            {weeks.map((week, index) => (
              <div key={index} style={weekRow}>
                {week.map((day) => (
                  <DayCell key={day.iso} day={day} currentMonth={currentMonth} />
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function DayCell({
  day,
  currentMonth,
}: {
  day: MonthDay;
  currentMonth: Date;
}) {
  const { date, iso, events } = day;
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isToday = isSameDay(date, new Date());

  return (
    <div
      style={{
        ...dayCell,
        opacity: isCurrentMonth ? 1 : 0.4,
        borderColor: isToday ? 'var(--primary)' : 'transparent',
      }}
    >
      <div style={dayNumber}>{format(date, 'd')}</div>
      <div style={dayEvents}>
        {events.map((event) => (
          <Link
            key={event.id}
            href={applicationRoute(event.application.applicationId)}
            style={{
              ...eventPill,
              background: event.type === 'Determination' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(250, 204, 21, 0.25)',
              borderColor: event.type === 'Determination' ? '#1d4ed8' : '#b45309',
              color: event.type === 'Determination' ? '#1d4ed8' : '#b45309',
            }}
          >
            <span>{event.application.prjCodeName}</span>
            <span style={{ fontSize: 11, opacity: 0.85 }}>{event.type}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LegendChip({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <span style={{ ...legendChip, background: color, borderColor: border, color: border }}>{label}</span>
  );
}

type MonthDay = {
  date: Date;
  iso: string;
  events: CalendarEvent[];
};

function buildMonthMatrix(currentMonth: Date, eventsByDay: Map<string, CalendarEvent[]>): MonthDay[][] {
  const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

  const matrix: MonthDay[][] = [];
  let cursor = start;

  while (cursor <= end) {
    const week: MonthDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      const iso = format(cursor, 'yyyy-MM-dd');
      week.push({
        date: cursor,
        iso,
        events: eventsByDay.get(iso) ?? [],
      });
      cursor = addDays(cursor, 1);
    }
    matrix.push(week);
  }

  return matrix;
}

async function fetchApplications(): Promise<CalendarEvent[]> {
  const responses = await Promise.all(STATUSES.map((status) => listApplications(status)));
  const applications = responses.flatMap((response) => response.items);

  const events: CalendarEvent[] = [];
  applications.forEach((application) => {
    if (application.determinationDate) {
      events.push({
        id: `${application.applicationId}-determination`,
        application,
        date: application.determinationDate,
        type: 'Determination',
      });
    }
    if (application.eotDate) {
      events.push({
        id: `${application.applicationId}-eot`,
        application,
        date: application.eotDate,
        type: 'Extension',
      });
    }
  });

  return events;
}

const layout: CSSProperties = {
  maxWidth: 1080,
  margin: '0 auto',
  padding: '32px 24px 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const monthControls: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
};

const navButton: CSSProperties = {
  background: 'rgba(37, 99, 235, 0.12)',
  border: 'none',
  borderRadius: '50%',
  width: 32,
  height: 32,
  fontSize: 16,
  cursor: 'pointer',
};

const legendRow: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
};

const calendarShell: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 20,
  background: 'var(--surface)',
  padding: 20,
  boxShadow: '0 20px 40px rgba(15, 23, 42, 0.1)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const calendarHeaderRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  textAlign: 'center',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-muted)',
};

const weekdayHeading: CSSProperties = {
  paddingBottom: 12,
};

const calendarGrid: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const weekRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 8,
};

const dayCell: CSSProperties = {
  minHeight: 120,
  borderRadius: 16,
  border: '2px solid transparent',
  background: 'rgba(248, 250, 252, 0.95)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
};

const dayNumber: CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
};

const dayEvents: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const eventPill: CSSProperties = {
  borderRadius: 14,
  border: '1px solid transparent',
  padding: '6px 8px',
  fontSize: 12,
  display: 'flex',
  flexDirection: 'column',
  textDecoration: 'none',
};

const legendChip: CSSProperties = {
  border: '1px solid',
  borderRadius: 999,
  padding: '4px 12px',
  fontSize: 12,
  fontWeight: 600,
};

const messageStyle: CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: 'var(--text-muted)',
};
