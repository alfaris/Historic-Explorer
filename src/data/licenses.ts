// Licenses a photo may use: ones that allow reuse with credit, with no
// non-commercial (NC) or no-derivatives (ND) restriction (photos are resized).
// The whole name must match, so "CC BY-NC 4.0" isn't accepted as "CC BY".
// Examples accepted: "CC BY 2.0", "CC BY-SA 4.0", "CC BY-SA 3.0 de", "CC0",
// "CC0 1.0", "Public domain", "PD".
// The optional suffix is a country code ("de", "igo"), never NC or ND.
export const FREE_LICENSE = /^(cc[ -]by(-sa)?( [\d.]+( (?!n[cd]$)[a-z]{2,3})?)?|cc0( 1\.0)?|public domain|pd)$/i;

export const isFreeLicense = (license: string) => FREE_LICENSE.test(license.trim());
