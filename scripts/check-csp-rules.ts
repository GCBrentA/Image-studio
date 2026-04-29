import assert from "node:assert/strict";
import { optivraContentSecurityPolicyDirectives, serializeContentSecurityPolicy } from "../src/config/contentSecurityPolicy";
import { env } from "../src/config/env";

const directives = optivraContentSecurityPolicyDirectives(env);
const header = serializeContentSecurityPolicy(directives);

const includesDirectiveSource = (directiveName: string, source: string): boolean => {
  const directive = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${directiveName} `));
  return Boolean(directive?.split(/\s+/).includes(source));
};

assert.equal(includesDirectiveSource("script-src", "https://www.googletagmanager.com"), true);
assert.equal(includesDirectiveSource("script-src-elem", "https://www.googletagmanager.com"), true);
assert.equal(includesDirectiveSource("script-src", "https://www.google-analytics.com"), true);
assert.equal(includesDirectiveSource("connect-src", "https://www.google-analytics.com"), true);
assert.equal(includesDirectiveSource("connect-src", "https://analytics.google.com"), true);
assert.equal(includesDirectiveSource("connect-src", "https://region1.google-analytics.com"), true);
assert.equal(includesDirectiveSource("style-src", "https://fonts.googleapis.com"), true);
assert.equal(includesDirectiveSource("style-src-elem", "https://fonts.googleapis.com"), true);
assert.equal(includesDirectiveSource("font-src", "https://fonts.gstatic.com"), true);
assert.equal(includesDirectiveSource("script-src", "*"), false);
assert.equal(includesDirectiveSource("connect-src", "*"), false);
assert.equal(includesDirectiveSource("frame-src", "*"), false);

console.log("CSP rule checks passed.");
