'use client';

import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput } from '@fullcalendar/core';

import { getTasks, deleteTask, getTask } from '@/lib/api/tasks';
import type { TaskDto } from '@/lib/api/types';
import TaskModal from '@/components/pages/tasks/task-modal';
import Chat from "@/components/pages/chat/chat";

function getEventColor(task: TaskDto): string {
  if (task.status === 'DONE') {
    return '#6b7280'; // gray
  }

  switch (task.priority) {
    case 'HIGH':
      return '#ef4444'; // red
    case 'MEDIUM':
      return '#f59e0b'; // amber
    case 'LOW':
      return '#10b981'; // green
    default:
      return '#3b82f6'; // blue
  }
}

function transformTasksToEvents(tasks: TaskDto[]): EventInput[] {
  return tasks
    .filter(task => task.deadline || task.createdAt) // Only show tasks with a date
    .map(task => {
      const date = task.deadline || task.createdAt;
      const isDeadline = !!task.deadline;

      return {
        id: task.id,
        title: task.name,
        start: date,
        allDay: !isDeadline, // If it's a deadline, show as all-day. If created date, also all-day
        backgroundColor: getEventColor(task),
        borderColor: getEventColor(task),
        extendedProps: {
          description: task.description,
          status: task.status,
          priority: task.priority,
          isDeadline,
        },
      };
    });
}

export default function Dashboard() {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const fetchedTasks = await getTasks();
      setTasks(fetchedTasks);
      const calendarEvents = transformTasksToEvents(fetchedTasks);
      setEvents(calendarEvents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg">Loading tasks...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg text-red-500">Error: {error}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen p-4 md:p-8">
      <div className="flex-1 rounded-lg shadow-lg p-4">
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
          eventClick={info => {
            const eventId = info.event.id;
            const task = tasks.find(t => t.id === eventId);
            if (task) {
              setSelectedTask(task);
            }
          }}
          editable={false}
          selectable={false}
        />
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onDelete={async (taskId: string) => {
            await deleteTask(taskId);
            await fetchTasks();
          }}
          onUpdate={async () => {
            await fetchTasks();
            // Refresh the selected task to show updated data
            try {
              const updatedTask = await getTask(selectedTask.id);
              setSelectedTask(updatedTask);
            } catch (err) {
              console.error('Failed to refresh task:', err);
              // If task was deleted or not found, close the modal
              setSelectedTask(null);
            }
          }}
        />
      )}
    </main>
  );
}
