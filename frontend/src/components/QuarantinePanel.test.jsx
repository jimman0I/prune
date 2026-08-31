import { render, screen, fireEvent } from '@testing-library/react';import QuarantinePanel from './QuarantinePanel';import { fetchQuarantineBatches, restoreQuarantineBatch, removeQuarantined } from '../lib/api';

jest.mock('../lib/api');

describe('QuarantinePanel', () => {
  const mockBatches = [
    {
      batchDir: 'batch1',
      programName: 'Program1',
      timestamp: '2023-01-01',
    },
    {
      batchDir: 'batch2',
      programName: 'Program2',
      timestamp: '2023-01-02',
    },
  ];

  beforeEach(() => {
    fetchQuarantineBatches.mockResolvedValue(mockBatches);
  });

  it('renders loading state initially', () => {
    render(<QuarantinePanel />);
    expect(screen.getByText('Loading quarantine batches…')).toBeInTheDocument();
  });

  it('renders batches after loading', async () => {
    render(<QuarantinePanel />);
    expect(await screen.findByText('Program1')).toBeInTheDocument();
    expect(screen.getByText('Program2')).toBeInTheDocument();
  });

  it('handles restore action', async () => {
    restoreQuarantineBatch.mockResolvedValue({});
    render(<QuarantinePanel />);
    const restoreButton = await screen.findByText('Restore');
    fireEvent.click(restoreButton);
    expect(restoreQuarantineBatch).toHaveBeenCalledWith('batch1');
  });

  it('handles remove action', async () => {
    removeQuarantined.mockResolvedValue({});
    render(<QuarantinePanel />);
    const removeButton = await screen.findByText('Remove');
    fireEvent.click(removeButton);
    expect(removeQuarantined).toHaveBeenCalledWith({
      programName: 'Program1',
      files: undefined,
      registryKeys: undefined,
    });
  });
});
