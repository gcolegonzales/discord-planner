import { describe, it, expect } from 'vitest';
import { encode, decode } from '../src/interactions/customId';
import type { CustomIdAction } from '../src/interactions/customId';

const ACTIONS: CustomIdAction[] = ['accept', 'setbusy', 'mybusy', 'results', 'leave'];

describe('customId encode/decode round-trip', () => {
  for (const action of ACTIONS) {
    it(`round-trips action "${action}" with a simple eventId`, () => {
      const eventId = 'event-abc-123';
      const encoded = encode(action, eventId);
      const decoded = decode(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.action).toBe(action);
      expect(decoded?.eventId).toBe(eventId);
    });
  }

  it('round-trips an eventId that contains colons', () => {
    const eventId = 'part1:part2:part3';
    const encoded = encode('accept', eventId);
    // Should be 'evt:accept:part1:part2:part3'
    expect(encoded).toBe('evt:accept:part1:part2:part3');
    const decoded = decode(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.action).toBe('accept');
    expect(decoded?.eventId).toBe(eventId);
  });
});

describe('customId decode — malformed input rejected (returns null)', () => {
  it('rejects an empty string', () => {
    expect(decode('')).toBeNull();
  });

  it('rejects a string that does not start with evt:', () => {
    expect(decode('btn:accept:123')).toBeNull();
    expect(decode('accept:123')).toBeNull();
  });

  it('rejects evt: with no action segment', () => {
    expect(decode('evt:')).toBeNull();
  });

  it('rejects evt: with action but no eventId', () => {
    expect(decode('evt:accept:')).toBeNull();
    expect(decode('evt:accept')).toBeNull();
  });

  it('rejects an unknown action', () => {
    expect(decode('evt:unknown:abc')).toBeNull();
    expect(decode('evt:click:abc')).toBeNull();
    expect(decode('evt:join:abc')).toBeNull();
  });

  it('rejects random garbage strings', () => {
    expect(decode('garbage')).toBeNull();
    expect(decode('::::')).toBeNull();
    expect(decode('evt::eventId')).toBeNull(); // empty action
  });
});

describe('customId encode format', () => {
  it('produces the expected literal format', () => {
    expect(encode('accept', 'abc')).toBe('evt:accept:abc');
    expect(encode('leave', 'xyz')).toBe('evt:leave:xyz');
    expect(encode('setbusy', '999')).toBe('evt:setbusy:999');
    expect(encode('mybusy', '999')).toBe('evt:mybusy:999');
    expect(encode('results', '999')).toBe('evt:results:999');
  });
});
