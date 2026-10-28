import formidable from "formidable";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "./funcionarios.validation.js";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const stagingDirectory = path.join(projectRoot, "storage", "funcionarios", "staging");
const photosDirectory = path.join(projectRoot, "public", "uploads", "funcionarios");
const maxPhotoSize = 2 * 1024 * 1024;
const formats = {
  "image/jpeg": { extension: "jpg", signature: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  "image/png": { extension: "png", signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }
};

function uploadedFiles(files) {
  return Object.values(files || {}).flatMap((value) => Array.isArray(value) ? value : value ? [value] : []);
}

export async function removeStagedPhoto(file) {
  if (file?.filepath) await rm(file.filepath, { force: true }).catch(() => {});
}

export async function parseFuncionarioRequest(req) {
  if (!req.is("multipart/form-data")) {
    if (req.is("application/json") || req.is("application/x-www-form-urlencoded")) {
      return { fields: req.body || {}, file: null };
    }
    throw new ApiError(415, "UNSUPPORTED_CONTENT_TYPE", "Use multipart/form-data ou application/json.");
  }

  await mkdir(stagingDirectory, { recursive: true });
  const form = formidable({
    uploadDir: stagingDirectory,
    maxFiles: 1,
    maxFileSize: maxPhotoSize,
    maxTotalFileSize: maxPhotoSize,
    allowEmptyFiles: false,
    multiples: false,
    filename: () => randomUUID(),
    filter: () => true
  });

  let fields;
  let files;
  const openedFiles = [];
  try {
    form.on("file", (_fieldName, uploaded) => openedFiles.push(uploaded));
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (error, parsedFields, parsedFiles) => {
        if (error) reject(error);
        else resolve([parsedFields, parsedFiles]);
      });
    });
  } catch (error) {
    await Promise.all(openedFiles.map(removeStagedPhoto));
    throw new ApiError(
      error.httpCode === 413 ? 413 : 400,
      error.httpCode === 413 ? "PHOTO_TOO_LARGE" : "INVALID_MULTIPART",
      error.httpCode === 413 ? "A foto deve ter no máximo 2 MB." : "Não foi possível ler o formulário multipart."
    );
  }

  const filesFound = uploadedFiles(files);
  const photo = files?.photo;
  const file = Array.isArray(photo) ? photo[0] : photo;
  if (filesFound.some((uploaded) => uploaded !== file)) {
    await Promise.all(filesFound.map(removeStagedPhoto));
    throw new ApiError(400, "UNSUPPORTED_FILE_FIELD", "Envie somente um arquivo no campo photo.");
  }
  if (file && (file.size > maxPhotoSize || file.size === 0)) {
    await removeStagedPhoto(file);
    throw new ApiError(file.size > maxPhotoSize ? 413 : 400, "INVALID_PHOTO_SIZE", "A foto deve ter entre 1 byte e 2 MB.");
  }

  const normalizedFields = {};
  for (const [key, values] of Object.entries(fields || {})) {
    if (!Array.isArray(values) || values.length !== 1) {
      await Promise.all(filesFound.map(removeStagedPhoto));
      throw new ApiError(400, "DUPLICATE_FIELD", `Campo multipart duplicado: ${key}.`);
    }
    normalizedFields[key] = values[0];
  }
  return { fields: normalizedFields, file: file || null };
}

export async function persistFuncionarioPhoto(file) {
  if (!file) return null;
  if (file.size > maxPhotoSize || file.size === 0) {
    await removeStagedPhoto(file);
    throw new ApiError(
      file.size > maxPhotoSize ? 413 : 400,
      "INVALID_PHOTO_SIZE",
      "A foto deve ter entre 1 byte e 2 MB."
    );
  }
  const format = formats[file.mimetype];
  if (!format) {
    await removeStagedPhoto(file);
    throw new ApiError(415, "INVALID_PHOTO_TYPE", "Foto deve ser JPEG ou PNG.");
  }

  const bytes = await readFile(file.filepath);
  if (!format.signature(bytes)) {
    await removeStagedPhoto(file);
    throw new ApiError(415, "INVALID_PHOTO_CONTENT", "O conteúdo do arquivo não corresponde a uma imagem JPEG ou PNG.");
  }

  await mkdir(photosDirectory, { recursive: true });
  const filename = `${randomUUID()}.${format.extension}`;
  const destination = path.join(photosDirectory, filename);
  await rename(file.filepath, destination);
  return `/uploads/funcionarios/${filename}`;
}

export async function removeFuncionarioPhoto(photoPath) {
  if (typeof photoPath !== "string" || !photoPath.startsWith("/uploads/funcionarios/")) return;
  const filename = photoPath.slice("/uploads/funcionarios/".length);
  if (!/^[0-9a-f-]{36}\.(jpg|png)$/.test(filename)) return;
  const destination = path.resolve(photosDirectory, filename);
  if (path.dirname(destination) === path.resolve(photosDirectory)) {
    await rm(destination, { force: true }).catch(() => {});
  }
}
