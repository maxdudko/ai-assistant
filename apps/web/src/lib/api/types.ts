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
  timezone?: string;
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
  difficulty: number;
  estimatedMinutes: number | null;
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
  difficulty?: number;
  estimatedMinutes?: number;
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
  difficulty?: number;
  estimatedMinutes?: number;
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
  totalTasks?: number;
  completedTasks?: number;
  progressPct?: number;
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
export type DayPhase = 'NOT_STARTED' | 'MORNING' | 'PLANNING' | 'EXECUTION' | 'EVENING' | 'CLOSED';

export interface DayDto {
  id: string;
  userId: string;
  date: string;
  state: DayState;
  phase: DayPhase;
  startedAt: string | null;
  endedAt: string | null;
  lastActivityAt?: string | null;
  createdAt: string;
  tasks?: TaskDto[];
  conversations?: ConversationDto[];
}

export interface DaySummaryDto {
  day: {
    id: string;
    date: string;
    state: DayState;
    phase: DayPhase;
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
    phase: DayPhase;
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

export interface DayIntelligenceDto {
  phase: DayPhase;
  load: {
    plannedMinutes: number;
    availableMinutes: number;
    overload: boolean;
  };
  topTasks: Array<{
    id: string;
    name: string;
    priority: TaskPriority;
    estimatedMinutes: number;
    score: number;
    reason: string;
  }>;
  suggestedActions: Array<{
    id: string;
    type: string;
    payload: Record<string, unknown>;
    confidence: number;
    createdAt: string;
  }>;
  insights: string[];
  reasoning: string[];
}

export type MemoryType = 'FACTUAL' | 'REFLECTION';
export type MemorySource = 'CONVERSATION' | 'REFLECTION' | 'ONBOARDING';
export type MemoryLayer = 'EPISODIC' | 'SEMANTIC' | 'PATTERN';

export interface MemoryDto {
  id: string;
  type: MemoryType;
  layer: MemoryLayer;
  content: string;
  importance: number;
  confidence: number;
  tags: string[];
  source: MemorySource;
  usageCount: number;
  lastUsedAt: string | null;
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

export interface WeeklyInsightDto {
  id: string;
  isoYear: number;
  isoWeek: number;
  weekStart: string;
  weekEnd: string;
  score: number;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  reschedules: number;
  topPatterns: string[];
  focusSuggestion: string | null;
  narrative: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyInsightListResponse {
  items: WeeklyInsightDto[];
  hasMore: boolean;
  nextOffset: number | null;
}

export interface GoalProgressDto {
  goal: {
    id: string;
    name: string;
    type: GoalType;
    priority: GoalPriority;
    isAchieved: boolean;
  };
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  completionRate: number;
  recentActivity: Array<{
    taskId: string;
    name: string;
    status: TaskStatus;
    updatedAt: string;
  }>;
}

export type TruthLensConfidence = 'low' | 'medium' | 'high';

export type SubscriptionPlan = 'FREE' | 'PRO';
export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

export type Feature = 'ADVANCED_INSIGHTS' | 'TRUTHLENS' | 'CROSS_WEEK_ANALYSIS';

export interface SubscriptionDto {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  hasStripeCustomer: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanCatalogEntryDto {
  plan: SubscriptionPlan;
  label: string;
  description: string;
  features: Feature[];
  limits: { maxDigestTopics: number };
}

export interface SubscriptionMeDto {
  subscription: SubscriptionDto;
  features: Feature[];
  plans: PlanCatalogEntryDto[];
  stripeConfigured: boolean;
}

export interface StripeRedirectDto {
  url: string;
}

export interface PaymentRecordDto {
  id: string;
  stripeInvoiceId: string;
  amountCents: number;
  currency: string;
  status: string;
  description: string | null;
  invoiceNumber: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

export interface SubscriptionEventDto {
  id: string;
  type: string;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  description: string;
  occurredAt: string;
}

export interface SubscriptionHistoryDto {
  payments: PaymentRecordDto[];
  events: SubscriptionEventDto[];
}

export interface TruthLensPerspectiveDto {
  label: string;
  claim: string;
  evidence: string[];
  limitations: string[];
}

export interface TruthLensReportDto {
  title: string;
  question: string;
  perspectives: TruthLensPerspectiveDto[];
  consensus: string | null;
  openQuestions: string[];
  confidence: TruthLensConfidence;
}

export interface AdminDto {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminUserListItemDto {
  id: string;
  email: string;
  suspendedAt: string | null;
  displayName: string | null;
  timezone: string | null;
  onboardingCompleted: boolean;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSubscriptionListItemDto {
  id: string;
  userId: string;
  userEmail: string;
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUpdateEmailRequest {
  email: string;
}

export interface AdminChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
