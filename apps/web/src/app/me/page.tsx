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
import Chat from '@/components/pages/chat/chat';
import Container from '@/components/common/container';

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
    <main className="xl:flex xl:h-screen xl:overflow-hidden min-h-screen md:p-8">
      <div className="flex-1 p-4 xl:h-full xl:overflow-hidden xl:flex xl:flex-col">
        <Chat />
      </div>
      <div className="flex-1 rounded-lg shadow-lg p-4 xl:h-full xl:overflow-y-auto">
        <Container className="p-4">
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
        </Container>
        <Container className="p-4 my-4">
          <b className="text-2xl p-4">Priorities:</b>
          <ul>
            {/*  Generate something like main priorities according current tasks className="ml-4 list-disc*/}
            <li className="ml-4 list-disc">
              Your main priority is completing your awesome super AI Assistant project MVP and
              release it to the world.
            </li>
            <li className="ml-4 list-disc">
              Don&#39;t forget for your main job and your project that give you money and stability.
            </li>
            <li className="ml-4 list-disc">
              Research and planning for your next big project, you need to paperer plans and to
              execute them.
            </li>
          </ul>
        </Container>
        <Container className="p-4 my-4">
          <b className="text-2xl p-4">Advices:</b>
          <ul>
            {/*  Generate something like advise from AI guru className="ml-4 list-disc*/}
            <li className="ml-4 list-disc">
              Prioritize tasks based on their impact and urgency, not just deadlines. Focus on
              high-impact tasks that align with your long-term goals, even if they don&#39;t have
              immediate deadlines.
            </li>
            <li className="ml-4 list-disc">
              Use time blocking to dedicate focused periods for deep work on important tasks,
              minimizing distractions and maximizing productivity.
            </li>
            <li className="ml-4 list-disc">
              Don&#39;t forget to take regular breaks to recharge your energy and maintain mental
              clarity. Short breaks can boost creativity and prevent burnout, helping you stay
              productive in the long run.
            </li>
            <li className="ml-4 list-disc">
              Also don&#39;t forget about your personal life and family, they are important for your
              well-being and happiness, and they can also provide support and motivation for your work.
            </li>
          </ul>
        </Container>
        <Container className="mt-6 p-4">
          <b className="text-2xl">Performance charts:</b>
          <Container className="mt-4 p-4">
            <h3 className="text-lg font-semibold mb-4">Task Status Distribution</h3>
            <div className="space-y-4">
              {(() => {
                const statusCounts = tasks.reduce(
                  (acc, task) => {
                    acc[task.status] = (acc[task.status] || 0) + 1;
                    return acc;
                  },
                  {} as Record<string, number>,
                );
                const total = tasks.length;
                const statuses: Array<{ status: string; label: string; color: string }> = [
                  { status: 'TODO', label: 'To Do', color: 'bg-[#3fb950]' },
                  { status: 'IN_PROGRESS', label: 'In Progress', color: 'bg-[#db6d28]' },
                  { status: 'DONE', label: 'Done', color: 'bg-[#ab7df8]' },
                ];

                return statuses.map(({ status, label, color }) => {
                  const count = statusCounts[status] || 0;
                  const percentage = total > 0 ? (count / total) * 100 : 0;

                  return (
                    <div key={status} className="w-full">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                        <span className="text-sm text-gray-600">
                          {count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div
                          className={`${color} h-6 rounded-full transition-all duration-300 flex items-center justify-end pr-2`}
                          style={{ width: `${percentage}%` }}
                        >
                          {percentage > 10 && (
                            <span className="text-white text-xs font-medium">{count}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            {tasks.length === 0 && (
              <p className="text-gray-500 text-sm mt-4">No tasks available to display.</p>
            )}
          </Container>
        </Container>
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
