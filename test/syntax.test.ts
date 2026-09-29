import { parseAddress } from '@email-utils/validator-syntax';
import { syntaxFixtures } from '@email-utils/validator-syntax/fixtures';
import { describe, expect, it } from 'vitest';
import { getProvider, isRoleAccount } from '../src';
import { partsOf } from '../src/address';

// The syntax corpus, split by the practical preset's verdict on each address.
const accepted = syntaxFixtures.filter(({ expected }) => expected.practical.ok);
const rejected = syntaxFixtures.filter(
  ({ expected }) => !expected.practical.ok,
);

describe('the classifier splits addresses as parseAddress does', () => {
  it('covers both sides of the corpus', () => {
    expect(accepted.length).toBeGreaterThan(0);
    expect(rejected.length).toBeGreaterThan(0);
  });

  it.each(accepted)('$address', ({ address }) => {
    const result = parseAddress(address, { preset: 'practical' });
    if (!result.ok) {
      throw new Error(`practical rejects ${address}: ${result.reason}`);
    }
    expect(partsOf(address)).toEqual(result.value);
    expect(getProvider(address)).toBe(getProvider(result.value));
    expect(isRoleAccount(address)).toBe(isRoleAccount(result.value));
  });

  it.each(rejected)('knows nothing of $address', ({ address }) => {
    expect(partsOf(address)).toBeUndefined();
    expect(getProvider(address)).toBeUndefined();
    expect(isRoleAccount(address)).toBe(false);
  });
});
