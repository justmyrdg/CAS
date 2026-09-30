import path from 'path';
import { Logger, NodeIO } from '@gltf-transform/core';
import type { Document, JSONDocument } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { metalRough } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { unzipSync } from 'fflate';
import { ApiError } from './ApiError';

// Every uploaded 3D model is normalised to one self-contained .glb that any glTF viewer (model-viewer in the admin
// preview, three.js in the student app's AR) draws with its textures:
//  - .gltf + its .bin / texture files arrive zipped and are packed into the .glb;
//  - KHR_materials_pbrSpecularGlossiness (old exporters, e.g. Microsoft's) is converted to standard metal/rough,
//    which three.js-based viewers require — they dropped spec/gloss and render such models untextured;
//  - Draco-compressed meshes are decompressed so viewers don't need a Draco decoder.

export const MODEL_EXTENSIONS = ['.glb', '.gltf', '.zip'];
// Unzipped size cap, so a small zip can't expand into gigabytes.
const MAX_UNZIPPED_BYTES = 200 * 1024 * 1024;

let ioPromise: Promise<NodeIO> | null = null;
function getIO() {
  ioPromise ??= draco3d.createDecoderModule().then((decoder) =>
    new NodeIO()
      .setLogger(new Logger(Logger.Verbosity.ERROR))
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'draco3d.decoder': decoder }),
  );
  return ioPromise;
}

interface GltfJson {
  asset?: unknown;
  buffers?: { uri?: string }[];
  images?: { uri?: string }[];
}

const externalUris = (json: GltfJson) =>
  [...(json.buffers ?? []), ...(json.images ?? [])].map((r) => r.uri).filter((uri): uri is string => !!uri && !uri.startsWith('data:'));

function parseGltfJson(data: Uint8Array): GltfJson {
  try {
    const json = JSON.parse(Buffer.from(data).toString('utf8')) as GltfJson;
    if (!json.asset) throw new Error('missing asset');
    return json;
  } catch {
    throw ApiError.badRequest('That file is not a valid .gltf model');
  }
}

function unzip(data: Buffer): Record<string, Uint8Array> {
  let total = 0;
  try {
    return unzipSync(data, {
      filter: (file) => {
        total += file.originalSize;
        if (total > MAX_UNZIPPED_BYTES) throw new Error('too big');
        // Skip folders and macOS metadata.
        return !file.name.endsWith('/') && !file.name.startsWith('__MACOSX/') && !path.posix.basename(file.name).startsWith('._');
      },
    });
  } catch (err) {
    throw ApiError.badRequest(err instanceof Error && err.message === 'too big' ? 'The zip is too large once extracted (200 MB max)' : 'That file is not a valid .zip');
  }
}

async function readZip(io: NodeIO, data: Buffer): Promise<Document> {
  const entries = unzip(data);
  const models = Object.keys(entries).filter((name) => /\.(gltf|glb)$/i.test(name));
  if (models.length === 0) throw ApiError.badRequest('The zip has no .gltf or .glb model in it');
  if (models.length > 1) throw ApiError.badRequest(`The zip has more than one model (${models.slice(0, 3).join(', ')}) — zip one model at a time`);
  const [modelName] = models;
  if (modelName.toLowerCase().endsWith('.glb')) return io.readBinary(entries[modelName]);

  // Resolve the .gltf's relative file references against the other files in the zip.
  const json = parseGltfJson(entries[modelName]);
  const dir = path.posix.dirname(modelName);
  const byLowerName = new Map(Object.keys(entries).map((name) => [name.toLowerCase(), name]));
  const resources: JSONDocument['resources'] = {};
  const missing: string[] = [];
  for (const uri of externalUris(json)) {
    const wanted = path.posix.normalize(path.posix.join(dir, decodeURIComponent(uri)));
    const found = entries[wanted] ?? entries[byLowerName.get(wanted.toLowerCase()) ?? ''];
    if (found) resources[uri] = new Uint8Array(found);
    else missing.push(uri);
  }
  if (missing.length) throw ApiError.badRequest(`The zip is missing files the model needs: ${missing.slice(0, 5).join(', ')}`);
  return io.readJSON({ json: json as JSONDocument['json'], resources });
}

// Returns the upload as a normalised .glb, or throws a 400 ApiError explaining what's wrong with it.
export async function convertToGlb(fileName: string, data: Buffer): Promise<Buffer> {
  const ext = path.extname(fileName).toLowerCase();
  if (!MODEL_EXTENSIONS.includes(ext)) throw ApiError.badRequest('Upload a .glb model, or a .zip with a .gltf and its files');
  if (data.length === 0) throw ApiError.badRequest('The file is empty');
  const io = await getIO();

  let doc: Document;
  try {
    if (ext === '.glb') {
      if (data.subarray(0, 4).toString('ascii') !== 'glTF') throw ApiError.badRequest('That file is not a valid .glb model');
      doc = await io.readBinary(data);
    } else if (ext === '.gltf') {
      const json = parseGltfJson(data);
      const external = externalUris(json);
      if (external.length) {
        throw ApiError.badRequest(
          `This .gltf keeps its data in separate files (${external.slice(0, 3).join(', ')}). Zip the .gltf together with those files and upload the .zip.`,
        );
      }
      doc = await io.readJSON({ json: json as JSONDocument['json'], resources: {} });
    } else {
      doc = await readZip(io, data);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.badRequest(`Couldn't read that model: ${err instanceof Error ? err.message : 'unknown error'}`);
  }

  try {
    const used = (name: string) => doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === name);
    if (used('KHR_materials_pbrSpecularGlossiness')) await doc.transform(metalRough());
    // Meshes were decoded on read; drop the extension so they're written uncompressed.
    used('KHR_draco_mesh_compression')?.dispose();
    return Buffer.from(await io.writeBinary(doc));
  } catch (err) {
    throw ApiError.badRequest(`Couldn't convert that model: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}
