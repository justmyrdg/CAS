import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsPBRSpecularGlossiness } from '@gltf-transform/extensions';
import { strToU8, zipSync } from 'fflate';
import { ApiError } from '../src/utils/ApiError';
import { convertToGlb } from '../src/utils/modelConversion';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// A one-triangle model whose material uses the given textures.
function triangle(configure: (doc: Document) => void) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const position = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buffer);
  const uv = doc.createAccessor().setType('VEC2').setArray(new Float32Array([0, 0, 1, 0, 0, 1])).setBuffer(buffer);
  const material = doc.createMaterial('mat');
  const prim = doc.createPrimitive().setAttribute('POSITION', position).setAttribute('TEXCOORD_0', uv).setMaterial(material);
  doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(prim)));
  configure(doc);
  return doc;
}

async function expectBadRequest(promise: Promise<unknown>, message: RegExp) {
  await assert.rejects(promise, (err: unknown) => err instanceof ApiError && err.status === 400 && message.test(err.message));
}

test('spec/gloss materials are converted to metal/rough, keeping the diffuse texture', async () => {
  const doc = triangle((d) => {
    const ext = d.createExtension(KHRMaterialsPBRSpecularGlossiness).setRequired(true);
    const diffuse = d.createTexture('diffuse').setImage(PNG).setMimeType('image/png');
    const specGloss = d.createTexture('sg').setImage(PNG).setMimeType('image/png');
    d.getRoot()
      .listMaterials()[0]
      .setExtension('KHR_materials_pbrSpecularGlossiness', ext.createPBRSpecularGlossiness().setDiffuseTexture(diffuse).setSpecularGlossinessTexture(specGloss));
  });
  const out = await io.readBinary(await convertToGlb('model.glb', Buffer.from(await io.writeBinary(doc))));
  const used = out.getRoot().listExtensionsUsed().map((e) => e.extensionName);
  assert.ok(!used.includes('KHR_materials_pbrSpecularGlossiness'));
  const material = out.getRoot().listMaterials()[0];
  assert.ok(material.getBaseColorTexture(), 'diffuse texture became the base color texture');
  assert.ok(material.getMetallicRoughnessTexture(), 'glossiness became a roughness texture');
});

test('a zipped .gltf is packed with its .bin and textures into one .glb', async () => {
  const doc = triangle((d) => {
    d.getRoot().listMaterials()[0].setBaseColorTexture(d.createTexture('color').setImage(PNG).setMimeType('image/png').setURI('textures/color.png'));
  });
  doc.getRoot().listBuffers()[0].setURI('scene.bin');
  const { json, resources } = await io.writeJSON(doc);
  const zip = zipSync({
    'model/scene.gltf': strToU8(JSON.stringify(json)),
    'model/scene.bin': resources['scene.bin'],
    'model/textures/color.png': resources['textures/color.png'],
    '__MACOSX/model/._scene.gltf': strToU8('junk'),
  });
  const glb = await convertToGlb('model.zip', Buffer.from(zip));
  assert.equal(glb.subarray(0, 4).toString('ascii'), 'glTF');
  const out = await io.readBinary(glb);
  assert.ok(out.getRoot().listMaterials()[0].getBaseColorTexture()?.getImage()?.length, 'texture is embedded');
});

test('a zip missing a texture says which file is missing', async () => {
  const doc = triangle((d) => {
    d.getRoot().listMaterials()[0].setBaseColorTexture(d.createTexture('color').setImage(PNG).setMimeType('image/png').setURI('color.png'));
  });
  doc.getRoot().listBuffers()[0].setURI('scene.bin');
  const { json, resources } = await io.writeJSON(doc);
  const zip = zipSync({ 'scene.gltf': strToU8(JSON.stringify(json)), 'scene.bin': resources['scene.bin'] });
  await expectBadRequest(convertToGlb('model.zip', Buffer.from(zip)), /missing files.*color\.png/);
});

test('a lone .gltf that needs separate files asks for a zip', async () => {
  const doc = triangle(() => undefined);
  doc.getRoot().listBuffers()[0].setURI('scene.bin');
  const { json } = await io.writeJSON(doc);
  await expectBadRequest(convertToGlb('model.gltf', Buffer.from(JSON.stringify(json))), /upload the \.zip/);
});

test('bad uploads are rejected with a clear message', async () => {
  await expectBadRequest(convertToGlb('model.fbx', Buffer.from('x')), /\.glb model, or a \.zip/);
  await expectBadRequest(convertToGlb('model.glb', Buffer.from('not a model')), /not a valid \.glb/);
  await expectBadRequest(convertToGlb('model.zip', Buffer.from('not a zip')), /not a valid \.zip/);
  await expectBadRequest(convertToGlb('model.zip', Buffer.from(zipSync({ 'readme.txt': strToU8('hi') }))), /no \.gltf or \.glb/);
});
