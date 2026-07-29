import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  SYNTHETIC_OCR_FIXTURE_PREFIX,
  formatHumanSummary,
  normalizeRepositoryPath,
  runCli,
  scanTrackedText,
  validateTrackedEntries,
  validateTrackedPath,
} from '../scripts/validate-public-repository.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function findingCodes(findings) {
  return findings.map((finding) => finding.code);
}

function localWindowsPath(drive, ...parts) {
  return [`${drive}:`, ...parts].join('\\');
}

function localUnixPath(...parts) {
  return ['', ...parts].join('/');
}

function localUncPath(server, ...parts) {
  return ['', '', server, ...parts].join('\\');
}

function encodeUtf16Le(text) {
  return Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(text, 'utf16le'),
  ]);
}

function encodeUtf16Be(text) {
  const littleEndian = Buffer.from(text, 'utf16le');
  const bigEndian = Buffer.alloc(littleEndian.length);
  for (let index = 0; index < littleEndian.length; index += 2) {
    bigEndian[index] = littleEndian[index + 1];
    bigEndian[index + 1] = littleEndian[index];
  }
  return Buffer.concat([Buffer.from([0xfe, 0xff]), bigEndian]);
}

function captureStream() {
  let output = '';
  return {
    stream: {
      write(chunk) {
        output += String(chunk);
        return true;
      },
    },
    read() {
      return output;
    },
  };
}

function runGit(rootDir, args, { input } = {}) {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    input,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

async function makeTrackedFixture(files) {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'public-repository-validator-'));
  runGit(rootDir, ['init', '--quiet']);

  for (const [repositoryPath, content] of Object.entries(files)) {
    const targetPath = path.join(rootDir, ...repositoryPath.split('/'));
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(
      targetPath,
      content,
      Buffer.isBuffer(content) ? undefined : 'utf8',
    );
  }

  runGit(rootDir, ['add', '--', '.']);
  return rootDir;
}

test('normalizes separators and blocks private roots without case bypasses', () => {
  assert.equal(
    normalizeRepositoryPath('.\\DATA-PRIVATE\\notes\\draft.json'),
    'DATA-PRIVATE/notes/draft.json',
  );
  assert.deepEqual(
    findingCodes(validateTrackedPath('DATA-PRIVATE\\notes\\draft.json')),
    ['PRIVATE_ROOT_TRACKED'],
  );
  assert.deepEqual(
    findingCodes(validateTrackedPath('Public\\PRIVATE\\notes.json')),
    ['PRIVATE_ROOT_TRACKED'],
  );
  assert.deepEqual(
    findingCodes(validateTrackedPath('SOURCE-PRIVATE\\raw\\book.pdf')),
    ['PRIVATE_ROOT_TRACKED'],
  );
});

test('blocks raw source current-tree files but allows repository-relative source references', () => {
  assert.deepEqual(
    findingCodes(validateTrackedPath('Source\\books\\original.pdf')),
    ['SOURCE_ROOT_TRACKED'],
  );

  const report = validateTrackedEntries([
    {
      path: 'docs/source-map.md',
      content: 'The protected input remains at source/books/original.pdf.',
    },
  ]);
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.findings, []);
});

test('blocks OCR processing artifacts and allows only the explicit synthetic fixture namespace', () => {
  assert.deepEqual(
    findingCodes(validateTrackedPath('PUBLIC\\books\\sample\\OCR\\pages\\001.txt')),
    ['OCR_PROCESSING_ARTIFACT_TRACKED'],
  );
  assert.deepEqual(
    findingCodes(validateTrackedPath('public/books/sample/ocr-report.json')),
    ['OCR_PROCESSING_ARTIFACT_TRACKED'],
  );
  assert.deepEqual(
    findingCodes(validateTrackedPath('public/books/sample/full-text.txt')),
    ['OCR_PROCESSING_ARTIFACT_TRACKED'],
  );

  const syntheticPath = `${SYNTHETIC_OCR_FIXTURE_PREFIX}OCR/pages/001.txt`
    .replaceAll('/', '\\');
  assert.deepEqual(validateTrackedPath(syntheticPath), []);
  assert.deepEqual(
    validateTrackedPath('archived/ocr-experiments/scripts/ocr-quality-report.mjs'),
    [],
  );
});

test('blocks task scratch, browser output, HAR, trace, profiles, cookies, and logs', () => {
  const cases = [
    ['task-scratch/notes.md', 'TASK_SCRATCH_TRACKED'],
    ['reports/Playwright-Report/index.html', 'PLAYWRIGHT_OUTPUT_TRACKED'],
    ['test-results/homepage/trace.zip', 'PLAYWRIGHT_OUTPUT_TRACKED'],
    ['captures/session.HAR', 'HAR_FILE_TRACKED'],
    ['captures/traces/run.json', 'TRACE_FILE_TRACKED'],
    ['tmp/browser-profile/Preferences', 'BROWSER_PROFILE_TRACKED'],
    ['captures/cookies.sqlite', 'BROWSER_PROFILE_TRACKED'],
    ['output/build.LOG', 'LOG_FILE_TRACKED'],
  ];

  for (const [repositoryPath, expectedCode] of cases) {
    assert.ok(
      findingCodes(validateTrackedPath(repositoryPath)).includes(expectedCode),
      `${repositoryPath} should produce ${expectedCode}`,
    );
  }
});

test('detects Windows, Unix, WSL, temporary, and UNC local paths while allowing URLs and relative paths', () => {
  const windowsPath = localWindowsPath(
    'D',
    'ChatGPT-Codex-Projects',
    'Family-Reading-Codex',
    'notes.json',
  );
  const escapedWindowsPath = windowsPath.replaceAll('\\', '\\\\');
  const unixPath = localUnixPath('home', 'reader', 'Family-Reading', 'notes.json');
  const unixTempPaths = [
    localUnixPath('tmp', 'family-reading', 'notes.json'),
    localUnixPath('var', 'tmp', 'family-reading', 'notes.json'),
    localUnixPath('private', 'tmp', 'family-reading', 'notes.json'),
  ];
  const unixLocalStatePath = localUnixPath(
    'var',
    'lib',
    'family-reading',
    'session.json',
  );
  const wslPath = localUnixPath(
    'mnt',
    'c',
    'Users',
    'reader',
    'Family-Reading',
    'notes.json',
  );
  const uncPath = localUncPath('build-server', 'private-share', 'notes.json');
  const escapedUncPath = uncPath.replaceAll('\\', '\\\\');
  const wslUncPath = localUncPath(
    'wsl$',
    'Ubuntu',
    'home',
    'reader',
    'notes.json',
  );

  assert.deepEqual(
    findingCodes(scanTrackedText('docs/windows.md', `Local: ${windowsPath}`)),
    ['WINDOWS_ABSOLUTE_PATH'],
  );
  assert.deepEqual(
    findingCodes(scanTrackedText('reports/windows.json', `{"path":"${escapedWindowsPath}"}`)),
    ['WINDOWS_ABSOLUTE_PATH'],
  );
  assert.deepEqual(
    findingCodes(scanTrackedText('docs/unix.md', `Local: ${unixPath}`)),
    ['UNIX_HOME_ABSOLUTE_PATH'],
  );
  for (const unixTempPath of unixTempPaths) {
    assert.deepEqual(
      findingCodes(scanTrackedText('docs/temp.md', `Local: ${unixTempPath}`)),
      ['UNIX_TEMP_ABSOLUTE_PATH'],
    );
  }
  assert.deepEqual(
    findingCodes(scanTrackedText(
      'docs/local-state.md',
      `Local: ${unixLocalStatePath}`,
    )),
    ['UNIX_LOCAL_STATE_PATH'],
  );
  assert.deepEqual(
    findingCodes(scanTrackedText('docs/wsl.md', `Local: ${wslPath}`)),
    ['WSL_MOUNTED_HOME_PATH'],
  );
  assert.deepEqual(
    findingCodes(scanTrackedText('docs/unc.md', `Local: ${uncPath}`)),
    ['UNC_ABSOLUTE_PATH'],
  );
  assert.deepEqual(
    findingCodes(scanTrackedText('reports/unc.json', `{"path":"${escapedUncPath}"}`)),
    ['UNC_ABSOLUTE_PATH'],
  );
  assert.deepEqual(
    findingCodes(scanTrackedText('docs/wsl-unc.md', `Local: ${wslUncPath}`)),
    ['UNC_ABSOLUTE_PATH'],
  );
  assert.deepEqual(
    scanTrackedText(
      'docs/links.md',
      'Use source/books/original.pdf and https://github.com/Archmays/Family-Reading.',
    ),
    [],
  );
});

test('allows only the exact standard Tesseract candidates in the two archived OCR tools', () => {
  const standardCandidates = [
    localWindowsPath('C', 'Program Files', 'Tesseract-OCR', 'tesseract.exe'),
    localWindowsPath('C', 'Program Files (x86)', 'Tesseract-OCR', 'tesseract.exe'),
  ];
  const allowedFiles = [
    'archived/ocr-experiments/scripts/work-cells-ocr-layout.mjs',
    'archived/ocr-experiments/scripts/work-cells-topic-ocr.mjs',
  ];

  for (const repositoryPath of allowedFiles) {
    for (const candidate of standardCandidates) {
      const sourceLiteral = candidate.replaceAll('\\', '\\\\');
      assert.deepEqual(scanTrackedText(repositoryPath, `'${sourceLiteral}'`), []);
    }
  }

  const standardLiteral = standardCandidates[0].replaceAll('\\', '\\\\');
  assert.deepEqual(
    findingCodes(scanTrackedText('scripts/other-tool.mjs', `'${standardLiteral}'`)),
    ['WINDOWS_ABSOLUTE_PATH'],
  );
  assert.deepEqual(
    findingCodes(scanTrackedText(
      allowedFiles[0],
      localWindowsPath('C', 'Users', 'reader', 'tesseract.exe'),
    )),
    ['WINDOWS_ABSOLUTE_PATH'],
  );
});

test('allows only the exact active global AGENTS path in the two correction audit docs', () => {
  const globalAgentsPath = localWindowsPath('C', 'Users', 'mays-', '.codex', 'AGENTS.md');
  const allowedFiles = [
    'docs/portfolio/fr-p0/FR-P0-final-report.md',
    'docs/portfolio/fr-p0/FR-P0R1-authorization-and-privacy-correction.md',
  ];

  for (const repositoryPath of allowedFiles) {
    assert.deepEqual(
      scanTrackedText(repositoryPath, `Global instructions: \`${globalAgentsPath}\`.`),
      [],
    );
  }

  assert.deepEqual(
    findingCodes(scanTrackedText(
      'docs/portfolio/fr-p0/FR-P0-baseline-report.md',
      globalAgentsPath,
    )),
    ['WINDOWS_ABSOLUTE_PATH'],
  );
  assert.deepEqual(
    findingCodes(scanTrackedText(
      allowedFiles[0],
      localWindowsPath('C', 'Users', 'another-user', '.codex', 'AGENTS.md'),
    )),
    ['WINDOWS_ABSOLUTE_PATH'],
  );
});

test('detects service tokens, generic secrets, private keys, and data URLs without echoing values', () => {
  const serviceToken = ['ghp', 'A'.repeat(32)].join('_');
  const secretName = ['api', 'key'].join('_');
  const secretValue = ['real', 'credential', 'value', '987654321'].join('-');
  const genericTokenName = ['"', 'token', '"'].join('');
  const genericTokenValue = ['runtime', 'token', 'value', '123456789'].join('-');
  const privateKeyHeader = ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ');
  const dataUrl = ['data:image/png;base64,', 'a'.repeat(48)].join('');
  const bearerToken = ['live', 'bearer', 'credential', '123456789'].join('-');
  const jwtToken = [
    `eyJ${'a'.repeat(12)}`,
    'b'.repeat(16),
    'c'.repeat(20),
  ].join('.');
  const lowercaseTokenName = ['to', 'ken'].join('');
  const lowercaseTokenValue = ['lowercase', 'credential', '123456789'].join('-');
  const awsSecretName = ['aws', 'secret', 'access', 'key'].join('_');
  const awsSecretValue = ['aws', 'credential', '12345678901234567890'].join('-');
  const content = [
    serviceToken,
    `${secretName}: "${secretValue}"`,
    `${genericTokenName}: "${genericTokenValue}"`,
    privateKeyHeader,
    dataUrl,
    `Authorization: Bearer ${bearerToken}`,
    jwtToken,
    `${lowercaseTokenName}=${lowercaseTokenValue}`,
    `${awsSecretName}=${awsSecretValue}`,
  ].join('\n');

  const findings = scanTrackedText('config/runtime.txt', content);
  assert.deepEqual(findingCodes(findings), [
    'PRIVATE_KEY_MATERIAL',
    'KNOWN_SERVICE_TOKEN',
    'EMBEDDED_DATA_URL',
    'BEARER_TOKEN',
    'JWT_TOKEN',
    'GENERIC_SECRET_ASSIGNMENT',
    'GENERIC_SECRET_ASSIGNMENT',
    'GENERIC_SECRET_ASSIGNMENT',
    'GENERIC_SECRET_ASSIGNMENT',
  ]);
  assert.equal(JSON.stringify(findings).includes(serviceToken), false);
  assert.equal(JSON.stringify(findings).includes(secretValue), false);
  assert.equal(JSON.stringify(findings).includes(genericTokenValue), false);
  assert.equal(JSON.stringify(findings).includes(bearerToken), false);
  assert.equal(JSON.stringify(findings).includes(jwtToken), false);
  assert.equal(JSON.stringify(findings).includes(lowercaseTokenValue), false);
  assert.equal(JSON.stringify(findings).includes(awsSecretValue), false);
});

test('allows conservative placeholders and user authorization metadata', () => {
  const secretName = ['client', 'secret'].join('_');
  const content = [
    `${secretName}: "your-placeholder-value"`,
    'Bearer your-placeholder-token',
    'token=replace-me-token',
    'aws_secret_access_key=example-only-value',
    'authorizationBasis: "user_confirmed_authorization"',
    'RIGHTS_STATUS: PASS_BY_USER_AUTHORIZATION',
  ].join('\n');

  assert.deepEqual(scanTrackedText('reports/status.txt', content), []);
});

test('allows Carmela page, audio, and full-work resource paths', () => {
  const report = validateTrackedEntries([
    'public/books/不一样的卡梅拉/我想去看海/pages/001.webp',
    'public/audio/不一样的卡梅拉/我想去看海.mp3',
    'public/books/不一样的卡梅拉/full-work/series.pdf',
    {
      path: 'public/books/不一样的卡梅拉/series.json',
      content: '{"authorizationBasis":"user_confirmed_authorization"}',
    },
  ]);

  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.findings, []);
});

test('returns a stable valid JSON report and concise human summary', () => {
  const report = validateTrackedEntries([
    { path: 'README.md', content: 'Public companion project.' },
  ]);
  const parsed = JSON.parse(JSON.stringify(report));

  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.validator, 'public-repository');
  assert.equal(parsed.status, 'PASS');
  assert.equal(parsed.findingCount, 0);
  assert.match(formatHumanSummary(parsed), /^Public repository validation: PASS/m);
});

test('fails closed when the bounded tracked-text scan cannot complete', () => {
  const report = validateTrackedEntries([
    {
      path: 'data/oversized.json',
      content: '{"partial":true}',
      truncated: true,
    },
    {
      path: 'docs/unscanned.md',
      scanStatus: 'budget',
    },
  ]);

  assert.equal(report.status, 'FAIL');
  assert.deepEqual(findingCodes(report.findings), [
    'TRACKED_TEXT_FILE_TRUNCATED',
    'TRACKED_TEXT_SCAN_BUDGET_EXCEEDED',
  ]);
});

test('Pages upload remains structurally downstream of the fail-closed release command', async () => {
  const workflow = await readFile(
    path.join(rootDir, '.github', 'workflows', 'pages.yml'),
    'utf8',
  );
  const releaseGate = 'run: npm run verify:public-release';
  const uploadAction = 'uses: actions/upload-pages-artifact@';
  const releaseGateIndex = workflow.indexOf(releaseGate);
  const uploadIndex = workflow.indexOf(uploadAction);

  assert.notEqual(releaseGateIndex, -1, 'Pages workflow should invoke verify:public-release');
  assert.notEqual(uploadIndex, -1, 'Pages workflow should declare the Pages artifact upload');
  assert.doesNotMatch(workflow, /actions\/setup-python|Pillow==/);
  assert.ok(
    releaseGateIndex < uploadIndex,
    'verify:public-release must complete successfully before artifact upload',
  );

  const releaseStep = workflow.slice(
    workflow.lastIndexOf('      - name:', releaseGateIndex),
    workflow.indexOf('      - name:', releaseGateIndex + releaseGate.length),
  );
  assert.equal(
    /continue-on-error:\s*true/i.test(releaseStep),
    false,
    'release verification must remain fail-closed',
  );
});

test('JSON-only CLI inventories Git-tracked files and exits zero for a clean fixture', async () => {
  const rootDir = await makeTrackedFixture({
    'docs/safe.md': 'Use source/books/original.pdf.',
    'public/books/不一样的卡梅拉/pages/001.webp': 'synthetic-binary-placeholder',
  });

  try {
    const capture = captureStream();
    const exitCode = await runCli({
      args: ['--json', '--root', rootDir],
      stdout: capture.stream,
    });
    const report = JSON.parse(capture.read());

    assert.equal(exitCode, 0);
    assert.equal(report.status, 'PASS');
    assert.equal(report.trackedFileCount, 2);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('CLI scans staged index bytes instead of trusting safer or less-safe worktree content', async () => {
  const unsafePath = localUnixPath('tmp', 'staged-private', 'notes.json');
  const unsafeWorktreePath = localUnixPath('var', 'tmp', 'worktree-only', 'notes.json');
  const rootDir = await makeTrackedFixture({
    'docs/staged-unsafe.md': `Local: ${unsafePath}`,
    'docs/staged-safe.md': 'Public companion documentation.',
  });

  try {
    await writeFile(
      path.join(rootDir, 'docs', 'staged-unsafe.md'),
      'Public companion documentation.',
      'utf8',
    );
    await writeFile(
      path.join(rootDir, 'docs', 'staged-safe.md'),
      `Local: ${unsafeWorktreePath}`,
      'utf8',
    );

    const capture = captureStream();
    const exitCode = await runCli({
      args: ['--json', '--root', rootDir],
      stdout: capture.stream,
    });
    const report = JSON.parse(capture.read());

    assert.equal(exitCode, 1);
    assert.ok(report.findings.some((item) => (
      item.path === 'docs/staged-unsafe.md'
      && item.code === 'UNIX_TEMP_ABSOLUTE_PATH'
    )));
    assert.equal(report.findings.some((item) => (
      item.path === 'docs/staged-safe.md'
      && item.code === 'UNIX_TEMP_ABSOLUTE_PATH'
    )), false);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('CLI rejects tracked symbolic links without following their worktree targets', async () => {
  const rootDir = await makeTrackedFixture({
    'README.md': 'Public companion project.',
  });

  try {
    const targetObjectId = runGit(
      rootDir,
      ['hash-object', '-w', '--stdin'],
      { input: 'README.md' },
    ).trim();
    runGit(rootDir, [
      'update-index',
      '--add',
      '--cacheinfo',
      `120000,${targetObjectId},docs/linked-readme.md`,
    ]);

    const capture = captureStream();
    const exitCode = await runCli({
      args: ['--json', '--root', rootDir],
      stdout: capture.stream,
    });
    const report = JSON.parse(capture.read());

    assert.equal(exitCode, 1);
    assert.ok(report.findings.some((item) => (
      item.path === 'docs/linked-readme.md'
      && item.code === 'TRACKED_SYMLINK'
    )));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('CLI decodes BOM-marked UTF-16 subtitles and scans all subtitle text extensions', async () => {
  const utf16LePath = localUnixPath('tmp', 'subtitle', 'captions.srt');
  const bearerToken = ['subtitle', 'bearer', 'credential', '123456789'].join('-');
  const uncPath = localUncPath('subtitle-server', 'private-share', 'captions.ass');
  const tokenName = ['to', 'ken'].join('');
  const tokenValue = ['subtitle', 'credential', '123456789'].join('-');
  const rootDir = await makeTrackedFixture({
    'captions/sample.srt': encodeUtf16Le(`1\n${utf16LePath}\n`),
    'captions/sample.vtt': encodeUtf16Be(`WEBVTT\nBearer ${bearerToken}\n`),
    'captions/sample.ass': `[Events]\nComment: ${uncPath}\n`,
    'captions/sample.ssa': `[Events]\n${tokenName}=${tokenValue}\n`,
  });

  try {
    const capture = captureStream();
    const exitCode = await runCli({
      args: ['--json', '--root', rootDir],
      stdout: capture.stream,
    });
    const report = JSON.parse(capture.read());

    assert.equal(exitCode, 1);
    const expectedFindings = [
      ['captions/sample.srt', 'UNIX_TEMP_ABSOLUTE_PATH'],
      ['captions/sample.vtt', 'BEARER_TOKEN'],
      ['captions/sample.ass', 'UNC_ABSOLUTE_PATH'],
      ['captions/sample.ssa', 'GENERIC_SECRET_ASSIGNMENT'],
    ];
    for (const [repositoryPath, code] of expectedFindings) {
      assert.ok(
        report.findings.some((item) => (
          item.path === repositoryPath && item.code === code
        )),
        `${repositoryPath} should produce ${code}`,
      );
    }
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('CLI fails closed on unrecognized NUL-encoded candidate text', async () => {
  const rootDir = await makeTrackedFixture({
    'captions/unrecognized.srt': Buffer.from([
      0x31, 0x00, 0x0a, 0x00, 0x41,
    ]),
  });

  try {
    const capture = captureStream();
    const exitCode = await runCli({
      args: ['--json', '--root', rootDir],
      stdout: capture.stream,
    });
    const report = JSON.parse(capture.read());

    assert.equal(exitCode, 1);
    assert.ok(report.findings.some((item) => (
      item.path === 'captions/unrecognized.srt'
      && item.code === 'TRACKED_TEXT_ENCODING_UNRECOGNIZED'
    )));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('JSON-only CLI exits nonzero when a forbidden tracked root is present', async () => {
  const rootDir = await makeTrackedFixture({
    'Data-Private/internal.json': '{"internal":true}',
  });

  try {
    const capture = captureStream();
    const exitCode = await runCli({
      args: ['--json', '--root', rootDir],
      stdout: capture.stream,
    });
    const report = JSON.parse(capture.read());

    assert.equal(exitCode, 1);
    assert.equal(report.status, 'FAIL');
    assert.ok(findingCodes(report.findings).includes('PRIVATE_ROOT_TRACKED'));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
