import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import express from 'express';
import { ApiError } from '../src/utils/ApiError';
import { cloudinaryPublicId, createLocalStorage } from '../src/utils/fileStorage';

async function withStorage(run: (root: string, storage: ReturnType<typeof createLocalStorage>) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), 'storage-test-'));
  try {
    await run(root, createLocalStorage(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('local storage saves, reads and removes files, one folder per kind', async () => {
  await withStorage(async (root, storage) => {
    await storage.save('ar', 'a.glb', Buffer.from('model'));
    await storage.save('images', 'a.png', Buffer.from('picture'));
    assert.deepEqual(await readdir(path.join(root, 'ar')), ['a.glb']);
    assert.equal((await storage.read('ar', 'a.glb')).toString(), 'model');
    await storage.remove('ar', 'a.glb');
    await assert.rejects(() => storage.read('ar', 'a.glb'), (err) => err instanceof ApiError && err.status === 404);
    await storage.remove('ar', 'a.glb'); // already gone: not an error
    assert.equal((await storage.read('images', 'a.png')).toString(), 'picture');
  });
});

test('local storage never leaves its folder, whatever the name says', async () => {
  await withStorage(async (root, storage) => {
    await storage.save('images', '../../escape.txt', Buffer.from('x'));
    assert.deepEqual(await readdir(path.join(root, 'images')), ['escape.txt']);
    assert.deepEqual((await readdir(root)).sort(), ['images']);
  });
});

test('send streams a stored file and answers 404 through ApiError when it is missing', async () => {
  await withStorage(async (_root, storage) => {
    await storage.save('ar', 'm.glb', Buffer.from('glb-bytes'));
    const app = express();
    app.get('/:name', async (req, res) => {
      try {
        res.type('model/gltf-binary');
        await storage.send(res, 'ar', req.params.name, 'Model file is missing');
      } catch (err) {
        const e = err as ApiError;
        res.status(e.status).json({ error: e.message });
      }
    });
    const server = app.listen(0);
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const ok = await fetch(`${base}/m.glb`);
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get('content-type'), 'model/gltf-binary');
      assert.equal(await ok.text(), 'glb-bytes');
      const missing = await fetch(`${base}/nope.glb`);
      assert.equal(missing.status, 404);
      assert.deepEqual(await missing.json(), { error: 'Model file is missing' });
    } finally {
      server.close();
    }
  });
});

test('cloudinaryPublicId puts every file under the prefix and its folder, using only the plain file name', () => {
  assert.equal(cloudinaryPublicId('cogniview', 'ar', 'abc.glb'), 'cogniview/ar/abc.glb');
  assert.equal(cloudinaryPublicId('cogniview', 'ar-triggers', 'abc.mind'), 'cogniview/ar-triggers/abc.mind');
  assert.equal(cloudinaryPublicId('', 'images', 'abc.png'), 'images/abc.png');
  assert.equal(cloudinaryPublicId('cogniview', 'images', '../../abc.png'), 'cogniview/images/abc.png');
});
