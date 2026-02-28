'use client';

import { useParams } from 'next/navigation';

import Index from '@/components/pages/chat/chat';

export default function ChatWithIdPage() {
  const params = useParams();
  const conversationId = params?.id as string | undefined;

  return (
    <div className="flex h-full flex-col">
      <Index conversationId={conversationId} />
    </div>
  );
}
