'use client';

import { useParams } from 'next/navigation';

import Chat from '@/components/chat';

export default function ChatWithIdPage() {
  const params = useParams();
  const conversationId = params?.id as string | undefined;

  return (
    <div className="flex h-full flex-col">
      <Chat conversationId={conversationId} />
    </div>
  );
}
