import { describe, it, expect } from 'vitest';
import { resolveAddress } from './jsonAddress.js';

describe('resolveAddress', () => {
  it('resolves a top-level key', () => {
    const obj = { account_info: { email: 'x' } };
    const result = resolveAddress(obj, 'account_info');
    expect(result).not.toBeNull();
    expect(result.parent).toBe(obj);
    expect(result.key).toBe('account_info');
  });

  it('resolves a nested key by slash-path', () => {
    const obj = { dns_prefetching: { host_referral_list: ['a', 'b'], startup_list: [] } };
    const result = resolveAddress(obj, 'dns_prefetching/host_referral_list');
    expect(result.parent).toBe(obj.dns_prefetching);
    expect(result.key).toBe('host_referral_list');
  });

  it('returns null for a key that does not exist', () => {
    const obj = { dns_prefetching: {} };
    expect(resolveAddress(obj, 'dns_prefetching/host_referral_list')).toBeNull();
  });

  it('returns null when an intermediate segment does not exist', () => {
    const obj = {};
    expect(resolveAddress(obj, 'dns_prefetching/host_referral_list')).toBeNull();
  });

  it('returns null when an intermediate segment is not an object', () => {
    const obj = { dns_prefetching: 'not an object' };
    expect(resolveAddress(obj, 'dns_prefetching/host_referral_list')).toBeNull();
  });

  it('returns null for a key present but explicitly set to undefined', () => {
    const obj = { account_info: undefined };
    expect(resolveAddress(obj, 'account_info')).toBeNull();
  });

  it('resolves a key whose value is null (the key itself still exists)', () => {
    const obj = { account_info: null };
    const result = resolveAddress(obj, 'account_info');
    expect(result).not.toBeNull();
    expect(result.key).toBe('account_info');
  });

  it('actually deleting the resolved key removes it from the real object', () => {
    const obj = { sync: { enabled: true } };
    const result = resolveAddress(obj, 'sync');
    delete result.parent[result.key];
    expect(obj).toEqual({});
  });

  it('returns null when a middle segment of a 3-level path is null', () => {
    const obj = { profile: { content_settings: null } };
    expect(resolveAddress(obj, 'profile/content_settings/exceptions')).toBeNull();
  });

  it('resolves a genuine 3-level nested key', () => {
    const obj = { profile: { content_settings: { exceptions: { notifications: {} } } } };
    const result = resolveAddress(obj, 'profile/content_settings/exceptions');
    expect(result).not.toBeNull();
    expect(result.parent).toBe(obj.profile.content_settings);
    expect(result.key).toBe('exceptions');
  });
});
