export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfileDto {
  displayName?: string;
  tone: 'neutral' | 'friendly' | 'strict';
  verbosity: 'low' | 'medium' | 'high';
  useEmoji: boolean;
}

export interface UserDto {
  id: string;
  email: string;
  profile?: UserProfileDto;
}

export interface UpdateMeRequest {
  email?: string;
  profile?: Partial<UserProfileDto>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export type ConversationMode = 'MANAGER' | 'REFLECTION' | 'COMPANION' | 'INFO';
export type ConversationState = 'CREATED' | 'ACTIVE' | 'ARCHIVED';
export type ConversationType = 'DAILY' | 'AD_HOC';
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface MessageDto {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ConversationDto {
  id: string;
  userId: string;
  mode: ConversationMode;
  state: ConversationState;
  type: ConversationType;
  date: string;
  createdAt: string;
  updatedAt: string;
  messages?: MessageDto[];
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
}

export interface SwitchModeRequest {
  mode: ConversationMode;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskSource = 'CHAT' | 'MANUAL';

export interface TaskDto {
  id: string;
  userId: string;
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
