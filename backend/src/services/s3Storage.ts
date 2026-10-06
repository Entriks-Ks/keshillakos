import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'

let client: S3Client | null = null

function bucketName() {
  const bucket = process.env.AWS_S3_BUCKET_NAME?.trim()
  if (!bucket) throw new Error('AWS_S3_BUCKET_NAME nuk është konfiguruar')
  return bucket
}

function s3() {
  if (!client) {
    const region = process.env.AWS_REGION?.trim()
    if (!region) throw new Error('AWS_REGION nuk është konfiguruar')
    // Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY via the default provider chain.
    client = new S3Client({ region })
  }
  return client
}

export async function putObject(key: string, body: Buffer, contentType: string, options?: { private?: boolean }) {
  if (key.startsWith('chat-private/') && !options?.private) throw new Error('Chat files require private storage')
  await s3().send(new PutObjectCommand({
    Bucket: bucketName(),
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: options?.private ? 'private, no-store' : 'public, max-age=31536000, immutable',
  }))
}

export async function getObject(key: string, ifNoneMatch?: string) {
  return s3().send(new GetObjectCommand({ Bucket: bucketName(), Key: key, IfNoneMatch: ifNoneMatch }))
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }))
}

export function s3StatusCode(err: unknown) {
  if (err instanceof S3ServiceException) return err.$metadata.httpStatusCode
  return undefined
}
