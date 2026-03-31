import type { ActionCandidate } from '@ai/shared-types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type ToneOption =
  | 'neutral'
  | 'friendly'
  | 'professional'
  | 'casual'
  | 'humorous'
  | 'empathetic';
export type VerbosityOption = 'short' | 'normal' | 'detailed';
export type PrimaryUseCaseOption = 'day-planning' | 'task-tracking' | 'reflection' | 'mixed';
export type HelpStyleOption = 'active' | 'passive';
export type TimePreferenceOption = 'morning' | 'evening' | 'anytime';

export interface UserProfileDto {
  displayName?: string;
  tone: ToneOption;
  verbosity: VerbosityOption;
  useEmoji: boolean;
  primaryUseCase?: PrimaryUseCaseOption;
  helpStyle?: HelpStyleOption;
  dayPlanningTime?: TimePreferenceOption;
  reflectionTime?: TimePreferenceOption;
  onboardingCompleted?: boolean;
}

export interface UserDto {
  id: string;
  email: string;
  profile?: UserProfileDto;
}

export interface UpdateMeRequest {
  email?: string;
  profile?: Partial<UserProfileDto> & {
    onboardingCompleted?: boolean;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export type ConversationMode = 'MANAGER' | 'REFLECTION' | 'COMPANION' | 'INFO';
export type ConversationState = 'CREATED' | 'ACTIVE' | 'ARCHIVED';
export type ConversationType = 'DAILY' | 'AD_HOC';
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface MessageDto {
  id: string;
  role: MessageRole;
  content: string;
  mode: ConversationMode;
  createdAt: string;
}

/** Standard shape for paginated list endpoints (`/api/tasks`, `/api/goals`, `/api/conversations`). */
export interface PaginatedList<T> {
  items: T[];
  hasMore: boolean;
  nextOffset: number | null;
}

export interface ConversationDto {
  id: string;
  userId: string;
  dayId: string | null;
  mode: ConversationMode;
  state: ConversationState;
  type: ConversationType;
  date: string;
  createdAt: string;
  updatedAt: string;
  messages?: MessageDto[];
  day?: DayDto | null;
  _count?: {
    messages: number;
  };
}

export interface SendMessageRequest {
  message: string;
  conversationId?: string;
  mode?: ConversationMode;
}

export interface SendMessageResponse {
  conversationId: string;
  message: MessageDto;
  actions?: ActionCandidate[];
}

export type SendMessageStreamEvent =
  | { type: 'start' }
  | { type: 'delta'; delta: string }
  | ({ type: 'complete' } & SendMessageResponse)
  | { type: 'error'; error: string };

export interface SwitchModeRequest {
  mode: ConversationMode;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskSource = 'CHAT' | 'MANUAL';

export interface TaskDto {
  id: string;
  userId: string;
  dayId: string | null;
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  source: TaskSource;
  conversationId: string | null;
  parentId: string | null;
  goalId: string | null;
  createdAt: string;
  updatedAt: string;
  conversation?: ConversationDto | null;
  parent?: TaskDto | null;
  subtasks?: TaskDto[];
  goal?: GoalDto | null;
  day?: DayDto | null;
}

export interface CreateTaskRequest {
  name: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: string;
  source?: TaskSource;
  conversationId?: string;
  parentId?: string;
}

export interface UpdateTaskRequest {
  name?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: string;
  parentId?: string;
  goalId?: string;
}

export type GoalType = 'SHORT' | 'MIDDLE' | 'LONG';
export type GoalPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type GoalSource = 'CHAT' | 'MANUAL';

export interface GoalDto {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  type: GoalType;
  priority: GoalPriority;
  isAchieved: boolean;
  source: GoalSource;
  conversationId: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  conversation?: ConversationDto | null;
  parent?: GoalDto | null;
  subgoals?: GoalDto[];
  tasks?: TaskDto[];
}

export interface CreateGoalRequest {
  name: string;
  description?: string;
  type?: GoalType;
  priority?: GoalPriority;
  isAchieved?: boolean;
  source?: GoalSource;
  conversationId?: string;
  parentId?: string;
}

export interface UpdateGoalRequest {
  name?: string;
  description?: string;
  type?: GoalType;
  priority?: GoalPriority;
  isAchieved?: boolean;
  parentId?: string;
}

export type DayState = 'START' | 'ACTIVE' | 'END';

export interface DayDto {
  id: string;
  userId: string;
  date: string;
  state: DayState;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  tasks?: TaskDto[];
  conversations?: ConversationDto[];
}

export interface DaySummaryDto {
  day: {
    id: string;
    date: string;
    state: DayState;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
  } | null;
  conversations: Array<{
    id: string;
    mode: ConversationMode;
    state: ConversationState;
    type: ConversationType;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  taskSummary: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    completionRate: number;
  };
  tasks: Array<{
    id: string;
    name: string;
    status: TaskStatus;
    priority: TaskPriority;
    goal: {
      id: string;
      name: string;
    } | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface MorningBriefingDto {
  day: {
    id: string;
    date: string;
    state: DayState;
  };
  tasks: Array<{
    id: string;
    name: string;
    status: TaskStatus;
    priority: TaskPriority;
    deadline: string | null;
  }>;
  priorities: Array<{
    id: string;
    name: string;
    priority: TaskPriority;
    deadline: string | null;
    reason: string;
  }>;
}

export type MemoryType = 'FACTUAL' | 'REFLECTION';
export type MemorySource = 'CONVERSATION' | 'REFLECTION' | 'ONBOARDING';

export interface MemoryDto {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;
  tags: string[];
  source: MemorySource;
  dayId: string | null;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiLogDto {
  id: string;
  userId: string;
  mode: ConversationMode;
  prompt: string;
  response: string;
  actions: unknown[];
  createdAt: string;
}

export interface GetLogsResponse {
  logs: AiLogDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
