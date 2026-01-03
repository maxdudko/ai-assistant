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
  role: 'user' | 'assistant' | 'system';
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
