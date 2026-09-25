import { describe, it, expect } from 'vitest';
import { ruleName, ruleDescription, categoryName, ruleSearchText, categorySearchText } from './cleanerText.js';

// Uses the real `el` module's own ids (brave_cache is translated, brave_history is not).
const cache = { id: 'brave_cache', category: 'Brave', name: 'Cache', description: 'Rebuilt as you browse.' };
const history = { id: 'brave_history', category: 'Brave', name: 'History', description: 'Pages you visited.' };

describe('cleanerText', () => {
  it('returns the translated name, description and category when there is one', () => {
    expect(ruleName('el', cache)).toBe('Προσωρινή μνήμη');
    expect(ruleDescription('el', cache)).toMatch(/[Ͱ-Ͽ]/);
    expect(categoryName('el', 'Brave')).toBe('Πρόγραμμα περιήγησης Brave');
  });

  it('falls back to the rule\'s own English for an unknown language', () => {
    expect(ruleName('xx', cache)).toBe('Cache');
    expect(ruleDescription('xx', cache)).toBe('Rebuilt as you browse.');
    expect(categoryName('xx', 'Brave')).toBe('Brave');
  });

  it('falls back to English for English itself, which has no module', () => {
    expect(ruleName('en', cache)).toBe('Cache');
    expect(categoryName('en', 'Brave')).toBe('Brave');
  });

  it('falls back to English for a rule or category the language lacks', () => {
    expect(ruleName('el', history)).toBe('History');
    expect(ruleDescription('el', history)).toBe('Pages you visited.');
    expect(categoryName('el', 'No Such Category')).toBe('No Such Category');
  });

  it('never throws or returns undefined on missing or odd input', () => {
    expect(ruleName('el', undefined)).toBe('');
    expect(ruleName('el', {})).toBe('');
    expect(ruleDescription('el', { id: 'brave_history' })).toBe('');
    expect(categoryName('el', undefined)).toBe('');
    expect(ruleName(undefined, cache)).toBe('Cache');
    expect(ruleName('el', { id: 'constructor', name: 'X' })).toBe('X');
  });

  it('search text carries both the translated and the English wording', () => {
    const text = ruleSearchText('el', cache);
    expect(text).toContain('προσωρινή μνήμη');
    expect(text).toContain('cache');
    expect(categorySearchText('el', 'Brave')).toContain('πρόγραμμα περιήγησης brave');
    expect(categorySearchText('el', 'Brave')).toContain('brave');
  });
});
