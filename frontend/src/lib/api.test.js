import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { fetchPrograms, fetchLeftovers, quarantineProgram, restoreProgram } from './api';

describe('API Functions', () => {
  const mockData = { data: 'mocked data' };

  beforeEach(() => {
    vi.spyOn(axios, 'get').mockResolvedValue(mockData);
    vi.spyOn(axios, 'post').mockResolvedValue(mockData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchPrograms should return data', async () => {
    const result = await fetchPrograms();
    expect(result).toEqual(mockData.data);
    expect(axios.get).toHaveBeenCalledWith('/programs');
  });

  it('fetchLeftovers should return data', async () => {
    const result = await fetchLeftovers();
    expect(result).toEqual(mockData.data);
    expect(axios.get).toHaveBeenCalledWith('/leftovers');
  });

  it('quarantineProgram should return data', async () => {
    const programId = '123';
    const result = await quarantineProgram(programId);
    expect(result).toEqual(mockData.data);
    expect(axios.post).toHaveBeenCalledWith(`/quarantine/${programId}`);
  });

  it('restoreProgram should return data', async () => {
    const programId = '123';
    const result = await restoreProgram(programId);
    expect(result).toEqual(mockData.data);
    expect(axios.post).toHaveBeenCalledWith(`/restore/${programId}`);
  });
});