import { describe, it, expect } from 'vitest';
import { ruleName, ruleDescription, categoryName } from './cleanerText.js';

/** The Custom locations rule is made by the backend from the user's own list,
 * so it has no entry in the per-language rule files: its words come from the
 * catalog. Rules the user imported keep the English their file gave them. */

const custom = { id: 'custom_locations', category: 'Custom', name: 'Custom locations', description: 'Files and folders you added yourself in Settings.', custom: true };

describe('the Custom locations rule', () => {
  it('reads in English as the backend wrote it', () => {
    expect(ruleName('en', custom)).toBe('Custom locations');
    expect(ruleDescription('en', custom)).toBe('Files and folders you added yourself in Settings.');
    expect(categoryName('en', 'Custom')).toBe('Custom');
  });

  it('reads in the language chosen', () => {
    expect(ruleName('de', custom)).toBe('Eigene Speicherorte');
    expect(categoryName('de', 'Custom')).toBe('Benutzerdefiniert');
    expect(ruleDescription('el', custom)).toMatch(/[Ͱ-Ͽ]/);
  });
});

describe('an imported rule', () => {
  const imported = { id: 'imp_slack_cache', category: 'Slack', name: 'Cache', description: 'Cached pages', imported: true };
  it('keeps the file\'s own words in every language', () => {
    expect(ruleName('de', imported)).toBe('Cache');
    expect(ruleDescription('ja', imported)).toBe('Cached pages');
    expect(categoryName('de', 'Slack')).toBe('Slack');
  });
});
