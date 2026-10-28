import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { persistFuncionarioPhoto, removeFuncionarioPhoto } from "../src/modules/usuarios/funcionarios.photo.js";

const stagingDirectory = path.join(process.cwd(), "storage", "funcionarios", "staging");
await mkdir(stagingDirectory, { recursive: true });

async function stagedFile(mimetype, bytes) {
  const filepath = path.join(stagingDirectory, `photo-test-${randomUUID()}`);
  await writeFile(filepath, bytes);
  return { filepath, mimetype, size: bytes.length };
}

const photos = [];

try {
  const jpeg = await stagedFile("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00]));
  const jpegUrl = await persistFuncionarioPhoto(jpeg);
  photos.push(jpegUrl);
  assert.match(jpegUrl, /^\/uploads\/funcionarios\/[0-9a-f-]{36}\.jpg$/);

  const png = await stagedFile(
    "image/png",
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0x00])
  );
  const pngUrl = await persistFuncionarioPhoto(png);
  photos.push(pngUrl);
  assert.match(pngUrl, /^\/uploads\/funcionarios\/[0-9a-f-]{36}\.png$/);

  const webp = await stagedFile("image/webp", Buffer.from("RIFF0000WEBP"));
  await assert.rejects(
    persistFuncionarioPhoto(webp),
    (error) => error.status === 415 && error.code === "INVALID_PHOTO_TYPE"
  );

  const mismatchedSignature = await stagedFile("image/png", Buffer.from("not a PNG"));
  await assert.rejects(
    persistFuncionarioPhoto(mismatchedSignature),
    (error) => error.status === 415 && error.code === "INVALID_PHOTO_CONTENT"
  );

  const oversized = await stagedFile(
    "image/png",
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(2 * 1024 * 1024)])
  );
  await assert.rejects(
    persistFuncionarioPhoto(oversized),
    (error) => error.status === 413 && error.code === "INVALID_PHOTO_SIZE"
  );

  console.log("Funcionario photo tests passed");
} finally {
  await Promise.all(photos.map(removeFuncionarioPhoto));
}
