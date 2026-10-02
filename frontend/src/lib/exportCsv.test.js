import { describe, it, expect } from 'vitest';
import { escapeCsvField, rowsToCsv, CSV_COLUMNS, exportFileName } from './exportCsv.js';

describe('escapeCsvField', () => {
  it('leaves a plain value alone', () => {
    expect(escapeCsvField('C:\\Games\\pak0.ucas')).toBe('C:\\Games\\pak0.ucas');
    expect(escapeCsvField(1234)).toBe('1234');
  });

  it('quotes a value with a comma, and doubles any quote inside', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes a value with a line break of either kind', () => {
    expect(escapeCsvField('a\nb')).toBe('"a\nb"');
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });

  it('writes nothing for a missing value, not the word null', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  // A file called =HYPERLINK(...) opened in a spreadsheet is a formula, not a
  // name. Text that would start one is neutralised with a leading apostrophe.
  it('neutralises text a spreadsheet would run as a formula', () => {
    expect(escapeCsvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsvField('+1')).toBe("'+1");
    expect(escapeCsvField('@cmd')).toBe("'@cmd");
    expect(escapeCsvField('-2+3')).toBe("'-2+3");
    expect(escapeCsvField('\tcmd')).toBe("'\tcmd");
  });

  it('does not touch a genuine negative number', () => {
    expect(escapeCsvField(-5)).toBe('-5');
  });

  it('still quotes after neutralising', () => {
    expect(escapeCsvField('=a,b')).toBe('"\'=a,b"');
  });
});

describe('rowsToCsv', () => {
  const rows = [
    { fullPath: 'C:\\Games', size: 800, allocated: 4096, files: 2, folders: 1, modified: Date.UTC(2026, 6, 4, 12, 30, 15) },
    { fullPath: 'C:\\note, "final".txt', size: 5, allocated: 0, files: 1, folders: 0, modified: null }
  ];

  it('starts with a header naming the six columns', () => {
    expect(CSV_COLUMNS).toEqual(['path', 'size', 'allocated', 'files', 'folders', 'modified']);
    expect(rowsToCsv(rows).split('\r\n')[0].replace('\uFEFF', '')).toBe('path,size,allocated,files,folders,modified');
  });

  it('writes one escaped line per row, dates as ISO-8601 UTC', () => {
    const lines = rowsToCsv(rows).split('\r\n');
    expect(lines[1]).toBe('C:\\Games,800,4096,2,1,2026-07-04T12:30:15.000Z');
    expect(lines[2]).toBe('"C:\\note, ""final"".txt",5,0,1,0,');
  });

  it('leads with a byte-order mark so Excel reads it as UTF-8', () => {
    expect(rowsToCsv(rows).startsWith('\uFEFF')).toBe(true);
  });

  it('ends with a line break and is just a header for no rows', () => {
    expect(rowsToCsv(rows).endsWith('\r\n')).toBe(true);
    expect(rowsToCsv([])).toBe('\uFEFFpath,size,allocated,files,folders,modified\r\n');
  });

  it('writes a missing allocated figure as empty, not zero', () => {
    const line = rowsToCsv([{ fullPath: 'C:\\x', size: 1, allocated: null, files: 1, folders: 0, modified: null }]).split('\r\n')[1];
    expect(line).toBe('C:\\x,1,,1,0,');
  });

  it('falls back to the name when a row has no full path', () => {
    expect(rowsToCsv([{ name: 'orphan', size: 1 }]).split('\r\n')[1]).toBe('orphan,1,,,,');
  });

  it('writes non-ASCII names as they are', () => {
    expect(rowsToCsv([{ fullPath: 'C:\\Φάκελος\\日本語.txt', size: 1 }]).split('\r\n')[1].startsWith('C:\\Φάκελος\\日本語.txt,')).toBe(true);
  });
});

describe('exportFileName', () => {
  it('names the file after the folder it describes and the date', () => {
    expect(exportFileName('C:\\Users\\me\\Games', 'csv', new Date(Date.UTC(2026, 6, 4)))).toBe('prune-Games-2026-07-04.csv');
  });

  it('uses the drive for a root', () => {
    expect(exportFileName('C:\\', 'png', new Date(Date.UTC(2026, 0, 2)))).toBe('prune-C-2026-01-02.png');
  });

  it('strips what Windows will not allow in a file name', () => {
    expect(exportFileName('C:\\a<b>c', 'csv', new Date(Date.UTC(2026, 0, 2)))).toBe('prune-a_b_c-2026-01-02.csv');
  });

  it('copes with no path at all', () => {
    expect(exportFileName(null, 'csv', new Date(Date.UTC(2026, 0, 2)))).toBe('prune-diskmap-2026-01-02.csv');
  });
});
