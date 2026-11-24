import { describe, expect, it } from 'vitest';
import { uniqueTopic } from '../realtimeTopic';

describe('uniqueTopic', () => {
  it('nao repete o topic entre duas montagens', () => {
    const a = uniqueTopic('runtime-error-logs-realtime');
    const b = uniqueTopic('runtime-error-logs-realtime');
    expect(a).not.toBe(b);
    expect(a.startsWith('runtime-error-logs-realtime-')).toBe(true);
    expect(b.startsWith('runtime-error-logs-realtime-')).toBe(true);
  });
});