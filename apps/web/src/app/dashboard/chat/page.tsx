import React from 'react';

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto rounded bg-neutral-900 p-4">
        <div className="text-sm text-neutral-400">PMA: How can I help you today?</div>
        <div className="self-end text-sm">User: Plan my day</div>
      </div>
      <form className="mt-4 flex gap-2">
        <input className="flex-1 rounded bg-neutral-800 p-2" placeholder="Type your message..." />
        <button className="rounded bg-indigo-600 px-4">Send</button>
      </form>
    </div>
  );
}
