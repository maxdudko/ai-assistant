import { IntentDetectorService } from './intent-detector.service';

describe('IntentDetectorService', () => {
  let service: IntentDetectorService;

  beforeEach(() => {
    service = new IntentDetectorService();
  });

  it('detects completion intent for multiple tasks in one message', () => {
    const actions = service.detect('Smarter Daily Flow and Task Intelligence we can mark as Done', [
      { id: 'task-1', name: 'Smarter Daily Flow' },
      { id: 'task-2', name: 'Task Intelligence' },
    ]);

    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe('TASK_UPDATE_STATUS');
    expect(actions[1].type).toBe('TASK_UPDATE_STATUS');
    expect(actions.map(action => action.payload.taskId)).toEqual(['task-1', 'task-2']);
  });

  it('does not create actions for read-only listing request', () => {
    const actions = service.detect('Could you give me tasks list?', [
      { id: 'task-1', name: 'Smarter Daily Flow' },
    ]);

    expect(actions).toEqual([]);
  });

  it('detects batch task creation from create-tasks list phrasing', () => {
    const actions = service.detect(
      'Just create 4 tasks: Enhanced Memory, Smarter Daily Flow, Task Intelligence, UX.',
    );

    expect(actions).toHaveLength(4);
    expect(actions.every(action => action.type === 'TASK_CREATE')).toBe(true);
    expect(actions.map(action => action.payload.title)).toEqual([
      'Enhanced Memory',
      'Smarter Daily Flow',
      'Task Intelligence',
      'UX',
    ]);
  });

  it('detects single create task with inline priority and deadline fields', () => {
    const actions = service.detect(
      'Create new task: Alpha Improvements Priority: High Deadline: April 25',
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual(
      expect.objectContaining({
        type: 'TASK_CREATE',
        payload: expect.objectContaining({
          title: 'Alpha Improvements',
          priority: 'HIGH',
          deadline: 'April 25',
        }),
      }),
    );
  });

  it('detects create task from action-style phrasing with name field', () => {
    const actions = service.detect(
      'Just create an action: Create_new task: name: Alpha Improvements',
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual(
      expect.objectContaining({
        type: 'TASK_CREATE',
        payload: expect.objectContaining({
          title: 'Alpha Improvements',
        }),
      }),
    );
  });

  it('detects polite create-task phrasing with inline fields', () => {
    const actions = service.detect(
      'Could you create new task: name: Alpha Improvements, priority: High deadline: April 25',
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual(
      expect.objectContaining({
        type: 'TASK_CREATE',
        payload: expect.objectContaining({
          title: 'Alpha Improvements',
          priority: 'HIGH',
          deadline: 'April 25',
        }),
      }),
    );
  });
});
