import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const bannedCopy = [
  "Here's the kicker",
  'The best part?',
  "But here's the thing",
  "It's not",
  'Revolutionize',
  'Supercharge',
  'Seamless',
  'Effortless',
  'Next-generation',
  'Powered by AI',
  'Unlock the power of',
  "In today's fast-paced world",
];
const typecheckBypassPattern = new RegExp('@ts-' + '(?:ignore|nocheck)', 'm');

export function collectTextFiles(root, path = root) {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) {
    return [{ path: relative(root, path).replaceAll('\\', '/'), contents: readFileSync(path, 'utf8') }];
  }
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.wrangler') return [];
    return collectTextFiles(root, join(path, entry.name));
  });
}

export function findLintViolations(files) {
  const violations = [];
  for (const file of files) {
    if (/\.(test|spec)\.[cm]?[jt]s$/i.test(file.path)) continue;
    if (/\.(ts|tsx)$/i.test(file.path) && /:\s*any\b|\bas\s+any\b|<any>/m.test(file.contents)) {
      violations.push({ path: file.path, rule: 'explicit-any' });
    }
    if (/console\.log\s*\(/m.test(file.contents)) {
      violations.push({ path: file.path, rule: 'console-log' });
    }
    const hasLineCommentEmoji = file.contents
      .split(/\r?\n/)
      .some((line) => /^\s*\/\/.*\p{Extended_Pictographic}/u.test(line));
    const hasBlockCommentEmoji = /(?:^|\n)\s*\/\*[\s\S]*?\p{Extended_Pictographic}[\s\S]*?\*\//u.test(
      file.contents,
    );
    if (hasLineCommentEmoji || hasBlockCommentEmoji) {
      violations.push({ path: file.path, rule: 'comment-emoji' });
    }
    if (typecheckBypassPattern.test(file.contents)) {
      violations.push({ path: file.path, rule: 'typecheck-bypass' });
    }
  }
  return violations;
}

export function findGenericViolations(files) {
  const violations = [];
  for (const file of files) {
    const normalised = file.contents.toLowerCase();
    if (bannedCopy.some((phrase) => normalised.includes(phrase.toLowerCase()))) {
      violations.push({ path: file.path, rule: 'banned-copy' });
    }
    if (/(linear|radial|conic)-gradient\s*\(/i.test(file.contents)) {
      violations.push({ path: file.path, rule: 'gradient' });
    }
    if (/backdrop-filter\s*:|background-clip\s*:\s*text/i.test(file.contents)) {
      violations.push({ path: file.path, rule: 'generic-visual' });
    }
    if (/<meta[^>]+name=["']generator["']/i.test(file.contents)) {
      violations.push({ path: file.path, rule: 'generator-meta' });
    }
    if (/<h[12][^>]*>[^<]*\p{Extended_Pictographic}/iu.test(file.contents)) {
      violations.push({ path: file.path, rule: 'heading-emoji' });
    }
    if (/(^|\/)(AGENTS\.md|CLAUDE\.md|\.cursorrules)$/i.test(file.path)) {
      violations.push({ path: file.path, rule: 'agent-file' });
    }
    if (/\.map$/i.test(file.path)) {
      violations.push({ path: file.path, rule: 'source-map' });
    }
  }
  return violations;
}
