#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, 'package.json');
const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
const nextVersion = pkg.dependencies?.next || pkg.devDependencies?.next || 'unknown';

const routes = [
  {
    path: '/*',
    target: {
      kind: 'Compute',
      src: 'default',
    },
  },
];

const manifest = {
  version: 1,
  routes,
  computeResources: [
    {
      name: 'default',
      entrypoint: 'server.js',
      runtime: 'nodejs20.x',
    },
  ],
  framework: {
    name: 'nextjs',
    version: nextVersion,
  },
};

const manifestPath = path.join(projectRoot, 'deploy-manifest.json');
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

const computeDir = path.join(projectRoot, 'compute', 'default');
await fs.mkdir(computeDir, { recursive: true });
const relativeServerPath = path.posix.join('..', '..', '.next', 'standalone', 'server.js');
const shimContent = `require('${relativeServerPath}');\n`;
await fs.writeFile(path.join(computeDir, 'server.js'), shimContent, 'utf-8');

console.log(`Wrote deploy manifest to ${manifestPath}`);
