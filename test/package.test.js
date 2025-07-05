import test from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';

async function readPackage() {
  const content = await fs.readFile('./package.json', 'utf8');
  return JSON.parse(content);
}

test('package.json has a name property', async () => {
  const pkg = await readPackage();
  assert.ok(pkg.name, 'Expected package name to be defined');
});

test('package.json defines a start script', async () => {
  const pkg = await readPackage();
  assert.ok(pkg.scripts && pkg.scripts.start, 'Expected start script to be defined');
});
