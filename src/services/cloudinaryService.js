import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../../.env');

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: envPath, override: true });
}

const endpoint = process.env.R2_ENDPOINT?.trim().replace(/\/$/, '');
const bucketName = process.env.R2_BUCKET_NAME?.trim();
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

const isConfigured = Boolean(
  endpoint && bucketName && publicBaseUrl && accessKeyId && secretAccessKey
);

const r2Client = isConfigured
  ? new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED'
    })
  : null;

const encodeObjectKey = (objectKey) => objectKey
  .split('/')
  .map((segment) => encodeURIComponent(segment))
  .join('/');

const buildObjectKey = (folder, mimeType, publicId) => {
  const extension = mimeType.split('/')[1]?.toLowerCase() || 'jpg';
  const safeExtension = extension === 'jpeg' ? 'jpg' : extension;
  const generatedName = `${crypto.randomUUID()}.${safeExtension}`;
  const normalizedFolder = folder.replace(/^\/+|\/+$/g, '');
  const requestedName = publicId?.replace(/^\/+/, '').replace(/\.\.+/g, '') || generatedName;
  return `${normalizedFolder}/${requestedName.includes('.') ? requestedName : `${requestedName}.${safeExtension}`}`;
};

export const storageService = {
  isConfigured,

  async uploadImage(file, options = {}) {
    if (!isConfigured) {
      throw new Error('R2 is not configured. Set R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.');
    }

    const folder = options.folder || 'trac/general';
    const allowedFormats = options.allowedFormats || ['jpg', 'jpeg', 'png', 'webp'];
    const maxBytes = options.maxBytes || 5 * 1024 * 1024;

    if (!file) {
      throw new Error('No file provided for upload.');
    }

    const fileBuffer = Buffer.isBuffer(file)
      ? file
      : file.buffer || file.data || null;

    if (!fileBuffer) {
      throw new Error('Unsupported file payload. Expected Buffer or multipart file data.');
    }

    if (fileBuffer.length > maxBytes) {
      throw new Error(`File too large. Maximum supported size is ${maxBytes / (1024 * 1024)}MB.`);
    }

    const mimeType = file.mimetype || file.type || '';
    const extension = mimeType.split('/')[1]?.toLowerCase();

    if (extension && !allowedFormats.includes(extension)) {
      throw new Error(`Unsupported image type: ${extension}. Allowed: ${allowedFormats.join(', ')}`);
    }

    const publicId = buildObjectKey(folder, mimeType || 'image/jpeg', options.publicId);
    try {
      await r2Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: publicId,
        Body: fileBuffer,
        ContentType: mimeType || 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable'
      }));
    } catch (error) {
      if (error.Code === 'SignatureDoesNotMatch' || error.name === 'SignatureDoesNotMatch') {
        throw new Error('R2 authentication failed. Verify that R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are the matching credentials from the same R2 API token.');
      }

      throw error;
    }

    return {
      success: true,
      url: `${publicBaseUrl}/${encodeObjectKey(publicId)}`,
      publicId,
      format: extension,
      resourceType: 'image',
      bytes: fileBuffer.length,
      folder
    };
  },

  async deleteImage(publicId) {
    if (!publicId) {
      return { success: true, deleted: false, message: 'No publicId provided.' };
    }

    if (!isConfigured) {
      throw new Error('R2 is not configured.');
    }

    await r2Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: publicId
    }));
    return {
      success: true,
      deleted: true,
      publicId
    };
  }
};

export default storageService;
