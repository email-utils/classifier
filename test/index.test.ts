import { expect, it } from 'vitest';
import { packageName } from '../src';

it('exports its package name', () => {
  expect(packageName).toBe('@email-utils/classifier');
});
