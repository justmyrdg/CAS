// draco3dgltf ships no types; only the decoder factory is used (see utils/modelConversion.ts).
declare module 'draco3dgltf' {
  const draco3d: { createDecoderModule(): Promise<unknown>; createEncoderModule(): Promise<unknown> };
  export default draco3d;
}
