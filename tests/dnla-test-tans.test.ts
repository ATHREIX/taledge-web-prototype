import assert from "node:assert/strict";
import test from "node:test";
import { buildDnlaTestStartUrl, parseDnlaTestTans } from "../lib/dnla-test-tans";

test("parses, validates, and deduplicates the server-side TAN pool", () => {
  assert.deepEqual(
    parseDnlaTestTans(
      "alpha1-ESK-bravo2-charlie3, invalid alpha1-ESK-bravo2-charlie3\nalpha2-AZS-bravo3-charlie4"
    ),
    ["alpha1-ESK-bravo2-charlie3", "alpha2-AZS-bravo3-charlie4"]
  );
});

test("builds the DNLA login URL at the root, not the spinner-only /start route", () => {
  assert.equal(
    buildDnlaTestStartUrl(
      "alpha1-ESK-bravo2-charlie3",
      "https://next.dnla.com/start?old=value"
    ),
    "https://next.dnla.com/?tan=alpha1-ESK-bravo2-charlie3"
  );
});

test("rejects insecure start hosts and malformed TANs", () => {
  assert.throws(
    () => buildDnlaTestStartUrl("alpha1-ESK-bravo2-charlie3", "http://next.dnla.com/"),
    /HTTPS/
  );
  assert.throws(() => buildDnlaTestStartUrl("not-a-tan"), /Invalid/);
});
