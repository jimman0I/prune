import { describe, it, expect } from 'vitest';
import { colorForNode } from './diskMapColors.js';

describe('colorForNode', () => {
  it('colors an app/executable blue', () => {
    expect(colorForNode({ name: 'setup.exe', type: 'file' })).toBe('#3b82f6');
    expect(colorForNode({ name: 'installer.msi', type: 'file' })).toBe('#3b82f6');
  });

  it('colors media purple', () => {
    expect(colorForNode({ name: 'clip.mp4', type: 'file' })).toBe('#8b5cf6');
    expect(colorForNode({ name: 'photo.JPG', type: 'file' })).toBe('#8b5cf6'); // case-insensitive
    expect(colorForNode({ name: 'song.mp3', type: 'file' })).toBe('#8b5cf6');
  });

  it('colors documents cyan', () => {
    expect(colorForNode({ name: 'report.pdf', type: 'file' })).toBe('#06b6d4');
    expect(colorForNode({ name: 'notes.docx', type: 'file' })).toBe('#06b6d4');
  });

  it('colors an unknown file extension gray', () => {
    expect(colorForNode({ name: 'weird.xyz', type: 'file' })).toBe('#545f6c');
  });

  it('colors a file with no extension gray', () => {
    expect(colorForNode({ name: 'README', type: 'file' })).toBe('#545f6c');
  });

  it('colors any directory gray, regardless of name', () => {
    expect(colorForNode({ name: 'Program Files.exe-lookalike', type: 'directory' })).toBe('#545f6c');
  });
});
