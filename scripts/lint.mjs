import { resolve } from 'node:path';

import { collectTextFiles, findLintViolations } from './quality.mjs';

const appRoot = resolve(import.meta.dirname, '..');
const files = collectTextFiles(appRoot).filter((file) =>
  /^(src|functions|scripts)\/.*\.(ts|tsx|mjs)$|^(vite|playwright)\.config\.ts$/.test(file.path),
);
const violations = findLintViolations(files);

if (violations.length > 0) {
  violations.forEach((violation) => process.stderr.write(`${violation.path}: ${violation.rule}\n`));
  process.exit(1);
}

process.stdout.write(`Lint passed for ${files.length} source files.\n`);
