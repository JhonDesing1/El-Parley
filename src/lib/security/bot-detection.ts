/**
 * Bot detection — blocks known malicious scanners and attack tools on API routes.
 *
 * Does NOT block legitimate developer tools (curl, wget, python-requests) to avoid
 * false positives on API integrations. The focus is on security scanners and exploit
 * frameworks that have no business hitting a sports-betting value platform.
 */

// Patterns matched against the User-Agent header (case-insensitive)
const BAD_BOT_PATTERNS: RegExp[] = [
  // Vulnerability scanners & exploit tools
  /sqlmap/i,
  /nikto/i,
  /nessus/i,
  /openvas/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /dirbuster/i,
  /gobuster/i,
  /nuclei/i,
  /acunetix/i,
  /burpsuite/i,
  // Aggressive SEO crawlers (high-volume, add no value to this platform)
  /ahrefsbot/i,
  /semrushbot/i,
  /dotbot/i,
  /mj12bot/i,
  /blexbot/i,
  /majestic/i,
  /petalbot/i,
  // Generic mass scrapers
  /scrapy/i,
  /mechanize/i,
];

/**
 * Returns true if the User-Agent matches a known bad bot pattern.
 * An absent (null) UA is allowed through — some legitimate clients omit it.
 */
export function isKnownBadBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BAD_BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}
