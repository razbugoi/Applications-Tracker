#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const nextDir = path.join(projectRoot, '.next');
const serverAppDir = path.join(nextDir, 'server', 'app');

const indexSrc = path.join(serverAppDir, 'index.html');
const indexDest = path.join(projectRoot, 'index.html');
const notFoundDest = path.join(projectRoot, '404.html');
const notFoundCandidates = [
  path.join(serverAppDir, '_not-found', 'index.html'),
  path.join(serverAppDir, '_not-found.html'),
];

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyWithLog(src, dest, label) {
  await fs.copyFile(src, dest);
  const relSrc = path.relative(projectRoot, src);
  const relDest = path.relative(projectRoot, dest);
  if (label) {
    console.log(`Copied ${label}: ${relSrc} -> ${relDest}`);
  } else {
    console.log(`Copied ${relSrc} -> ${relDest}`);
  }
}

if (!(await fileExists(indexSrc))) {
  throw new Error(`Missing Next.js app index at ${indexSrc}`);
}
await copyWithLog(indexSrc, indexDest, 'index');

let notFoundCopied = false;
for (const candidate of notFoundCandidates) {
  if (await fileExists(candidate)) {
    await copyWithLog(candidate, notFoundDest, '404');
    notFoundCopied = true;
    break;
  }
}

if (!notFoundCopied) {
  const searchedPaths = notFoundCandidates
    .map((candidate) => path.relative(projectRoot, candidate))
    .join(', ');
  throw new Error(`Missing Next.js not-found page. Checked paths: ${searchedPaths}`);
}
