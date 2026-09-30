import 'dotenv/config';
import { prisma } from '../src/config/prisma';
import { reconvertStoredModel } from '../src/services/arModels.service';

// Re-runs the upload conversion (utils/modelConversion.ts) on every stored AR model, so models uploaded before it
// existed get their textures fixed (spec/gloss → metal/rough) and become self-contained .glb files.
// Safe to run more than once: an already-converted .glb comes out unchanged in meaning.
async function main() {
  const models = await prisma.arModel.findMany({ select: { id: true, name: true }, orderBy: { createdAt: 'asc' } });
  if (models.length === 0) {
    console.log('No AR models to convert.');
    return;
  }
  let failed = 0;
  for (const m of models) {
    try {
      const { before, after } = await reconvertStoredModel(m.id);
      console.log(`✓ ${m.name} (${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB)`);
    } catch (err) {
      failed += 1;
      console.error(`✗ ${m.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`Converted ${models.length - failed} of ${models.length} models.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
