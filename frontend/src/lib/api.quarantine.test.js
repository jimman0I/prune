import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchQuarantineBatches, restoreQuarantineBatch, removeQuarantined } from './api.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('quarantine API functions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchQuarantineBatches', () => {
    it('returns batches with batchDir field from API response', async () => {
      const mockBatches = [
        {
          programName: 'TestApp',
          timestamp: '2024-01-15T10:30:00.000Z',
          batchDir: '/full/path/to/quarantine/1705312200000-TestApp',
          createdAt: 1705312200000,
          files: [{ originalPath: 'C:\\Program Files\\TestApp\\test.exe', quarantinedPath: '/quarantine/path/file-0-test.exe' }],
          registryKeys: ['HKCU\\Software\\TestApp'],
          regFiles: ['/quarantine/path/registry-0.reg']
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ batches: mockBatches })
      });

      const result = await fetchQuarantineBatches();

      expect(result).toEqual(mockBatches);
      // Critical: verify the field name is batchDir, not dirName
      expect(result[0]).toHaveProperty('batchDir');
      expect(result[0]).not.toHaveProperty('dirName');
    });

    it('throws on API error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' })
      });

      await expect(fetchQuarantineBatches()).rejects.toThrow('Server error');
    });
  });

  describe('restoreQuarantineBatch', () => {
    it('calls correct endpoint with batchDir as path parameter', async () => {
      const batchDir = '1705312200000-TestApp';
      const mockResponse = { success: true, restored: batchDir };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await restoreQuarantineBatch(batchDir);

      expect(fetch).toHaveBeenCalledWith(
        `http://127.0.0.1:3101/api/quarantine/${encodeURIComponent(batchDir)}/restore`,
        { method: 'POST' }
      );
      expect(result).toEqual(mockResponse);
    });

    it('throws on API error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Batch not found' })
      });

      await expect(restoreQuarantineBatch('nonexistent')).rejects.toThrow('Batch not found');
    });
  });

  describe('removeQuarantined', () => {
    it('posts programName, files, registryKeys to /quarantine/remove', async () => {
      const payload = {
        programName: 'TestApp',
        files: [{ originalPath: 'C:\\test.exe', quarantinedPath: '/q/test.exe' }],
        registryKeys: ['HKCU\\Software\\TestApp']
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await removeQuarantined(payload);

      expect(fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3101/api/quarantine/remove',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      );
      expect(result).toEqual({ success: true });
    });
  });
});