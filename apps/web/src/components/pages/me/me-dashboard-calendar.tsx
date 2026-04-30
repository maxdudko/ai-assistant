'use client';

import type { FC } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput } from '@fullcalendar/core';

import type { TaskDto } from '@/lib/api/types';

interface MeDashboardCalendarProps {
  events: EventInput[];
  tasks: TaskDto[];
  onTaskSelect: (task: TaskDto) => void;
}

const MeDashboardCalendar: FC<MeDashboardCalendarProps> = ({ events, tasks, onTaskSelect }) => (
  <FullCalendar
    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
    initialView="dayGridMonth"
    headerToolbar={{
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    }}
    events={events}
    height="auto"
    dayMaxEventRows={2}
    moreLinkClick="popover"
    eventDidMount={info => {
      info.el.setAttribute('title', info.event.title ?? '');
    }}
    eventClick={info => {
      const eventId = info.event.id;
      const task = tasks.find(t => t.id === eventId);
      if (task) {
        onTaskSelect(task);
      }
    }}
    editable={false}
    selectable={false}
  />
);

export default MeDashboardCalendar;
