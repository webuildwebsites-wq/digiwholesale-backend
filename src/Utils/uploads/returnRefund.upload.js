import { bucket } from "../../core/config/bucket/gcs.js";

/**
 * Upload a single file to GCS under the "return-refund/" folder.
 * Returns the public URL string.
 */
export const uploadReturnRefundFile = (file, folder = "return-refund") => {
  return new Promise((resolve, reject) => {
    try {
      if (!file) return reject(new Error("No file provided"));

      const fileName = `${folder}/${Date.now()}-${file.originalname}`;
      const bucketFile = bucket.file(fileName);

      const blobStream = bucketFile.createWriteStream({
        resumable: false,
        metadata: { contentType: file.mimetype },
      });

      blobStream.on("error", reject);

      blobStream.on("finish", () => {
        const publicUrl = encodeURI(
          `https://storage.googleapis.com/${bucket.name}/${bucketFile.name}`
        );
        resolve(publicUrl);
      });

      blobStream.end(file.buffer);
    } catch (error) {
      reject(error);
    }
  });
};
