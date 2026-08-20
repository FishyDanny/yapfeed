import { resolve } from 'node:path';

import { collectTextFiles, findGenericViolations } from './quality.mjs';

const appRoot = resolve(import.meta.dirname, '..');
const sourceFiles = collectTextFiles(appRoot).filter((file) =>
  /^(index\.html|src\/.*\.(ts|css))$/.test(file.path),
);
const distFiles = collectTextFiles(resolve(appRoot, 'dist')).map((file) => ({
  ...file,
  path: `dist/${file.path}`,
}));
const violations = findGenericViolations([...sourceFiles, ...distFiles]);

if (violations.length > 0) {
  violations.forEach((violation) => process.stderr.write(`${violation.path}: ${violation.rule}\n`));
  process.exit(1);
}

process.stdout.write(`Anti-generic check passed for ${sourceFiles.length + distFiles.length} files.\n`);
