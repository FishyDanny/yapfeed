import { describe, expect, it } from 'vitest';

import { findGenericViolations, findLintViolations } from './quality.mjs';

describe('release quality checks', () => {
  it('rejects explicit any, typecheck bypasses, debug logging and comment emoji', () => {
    const violations = findLintViolations([
      {
        path: 'src/example.ts',
        contents: 'const payload: any = value;\n// @ts-ignore\nconsole.log(payload);\n// launch 🚀',
      },
    ]);

    expect(violations.map((violation) => violation.rule)).toEqual([
      'explicit-any',
      'console-log',
      'comment-emoji',
      'typecheck-bypass',
    ]);
  });

  it('rejects planted copy, visual and deployed build artefacts', () => {
    const violations = findGenericViolations([
      {
        path: 'dist/index.html',
        contents:
          '<meta name="generator" content="tool"><h1>Supercharge it</h1><style>.hero{background:linear-gradient(red,blue);backdrop-filter:blur(2px)}</style>',
      },
      { path: 'dist/AGENTS.md', contents: 'instructions' },
      { path: 'dist/assets/app.js.map', contents: '{}' },
    ]);

    expect(violations.map((violation) => violation.rule)).toEqual([
      'banned-copy',
      'gradient',
      'generic-visual',
      'generator-meta',
      'agent-file',
      'source-map',
    ]);
  });

  it('does not treat a URL inside user-facing copy as a code comment', () => {
    expect(
      findLintViolations([
        {
          path: 'src/example.ts',
          contents: '`<a href="https://example.com">Source ↗</a>`;',
        },
      ]),
    ).toEqual([]);
  });
});
