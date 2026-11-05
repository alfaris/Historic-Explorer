import { describe, expect, it } from 'vitest';
import { isFreeLicense } from './licenses';

describe('isFreeLicense', () => {
  it.each(['CC BY 2.0', 'CC BY 3.0', 'CC BY-SA 2.0', 'CC BY-SA 4.0', 'CC BY-SA 3.0 de', 'CC BY 3.0 igo', 'CC0', 'CC0 1.0', 'Public domain', 'PD', 'cc by-sa 4.0'])(
    'accepts %s',
    license => expect(isFreeLicense(license)).toBe(true),
  );

  it.each(['CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 4.0', 'CC BY-NC-ND 3.0', 'CC BY-SA 4.0 NC', 'GFDL', 'Fair use', 'All rights reserved', '', 'CC BY-SA-NC'])(
    'rejects "%s"',
    license => expect(isFreeLicense(license)).toBe(false),
  );
});
