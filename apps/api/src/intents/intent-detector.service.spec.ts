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
});
