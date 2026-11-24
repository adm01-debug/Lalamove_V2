import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

type FakeChannel = {
  topic: string;
  subscribed: boolean;
  on: (type: string) => FakeChannel;
  subscribe: () => FakeChannel;
};

const realtime = vi.hoisted(() => {
  const channels: FakeChannel[] = [];

  const channel = (topic: string): FakeChannel => {
    const existing = channels.find((c) => c.topic === topic);
    if (existing) return existing;

    const created: FakeChannel = {
      topic,
      subscribed: false,
      on(type: string) {
        // realtime-js 2.x: proibe novos callbacks depois do subscribe()
        if (created.subscribed && type === 'postgres_changes') {
          throw new Error(
            'cannot add `' + type + '` callbacks for ' + topic + ' after `subscribe()`.',
          );
        }
        return created;
      },
      subscribe() {
        created.subscribed = true;
        return created;
      },
    };

    channels.push(created);
    return created;
  };

  const removeChannel = (target: FakeChannel) => {
    const index = channels.indexOf(target);
    if (index >= 0) channels.splice(index, 1);
  };

  return { channels, channel, removeChannel };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: realtime.channel,
    removeChannel: realtime.removeChannel,
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { useSidebarCountsRealtime } from '../useRealtimeSubscriptions';

describe('canais realtime', () => {
  beforeEach(() => {
    realtime.channels.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('dois consumidores do mesmo hook nao reutilizam o canal ja subscrito', () => {
    const onUpdate = () => {};

    const primeiro = renderHook(() => useSidebarCountsRealtime(onUpdate));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(realtime.channels).toHaveLength(1);
    expect(realtime.channels[0].subscribed).toBe(true);

    let erro: unknown = null;
    try {
      renderHook(() => useSidebarCountsRealtime(onUpdate));
    } catch (e) {
      erro = e;
    }

    expect(erro).toBeNull();
    expect(realtime.channels).toHaveLength(2);
    expect(realtime.channels[0].topic).not.toBe(realtime.channels[1].topic);

    primeiro.unmount();
  });
});