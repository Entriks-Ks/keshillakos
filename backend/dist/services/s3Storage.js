"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.putObject = putObject;
exports.getObject = getObject;
exports.deleteObject = deleteObject;
exports.s3StatusCode = s3StatusCode;
const client_s3_1 = require("@aws-sdk/client-s3");
let client = null;
function bucketName() {
    const bucket = process.env.AWS_S3_BUCKET_NAME?.trim();
    if (!bucket)
        throw new Error('AWS_S3_BUCKET_NAME nuk është konfiguruar');
    return bucket;
}
function s3() {
    if (!client) {
        const region = process.env.AWS_REGION?.trim();
        if (!region)
            throw new Error('AWS_REGION nuk është konfiguruar');
        // Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY via the default provider chain.
        client = new client_s3_1.S3Client({ region });
    }
    return client;
}
async function putObject(key, body, contentType) {
    await s3().send(new client_s3_1.PutObjectCommand({
        Bucket: bucketName(),
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
    }));
}
async function getObject(key, ifNoneMatch) {
    return s3().send(new client_s3_1.GetObjectCommand({ Bucket: bucketName(), Key: key, IfNoneMatch: ifNoneMatch }));
}
async function deleteObject(key) {
    await s3().send(new client_s3_1.DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
}
function s3StatusCode(err) {
    if (err instanceof client_s3_1.S3ServiceException)
        return err.$metadata.httpStatusCode;
    return undefined;
}
//# sourceMappingURL=s3Storage.js.map