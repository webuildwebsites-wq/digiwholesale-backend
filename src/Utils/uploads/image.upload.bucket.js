import { bucket } from "../../core/config/bucket/gcs.js";
import { sendSuccessResponse, sendErrorResponse } from "../response/responseHandler.js";
import { v4 as uuidv4 } from "uuid";

export const uploadImageToBucket = async (req, res) => {
  try {
    if (!req.file) {
      return sendErrorResponse(res, 400, "NO_FILE", "No file uploaded");
    }

    const fileExt = req.file.originalname.split(".").pop().toLowerCase();
    const fileName = `images/${uuidv4()}.${fileExt}`;
    const file = bucket.file(fileName);

    await new Promise((resolve, reject) => {
      const blobStream = file.createWriteStream({
        resumable: false,
        metadata: { contentType: req.file.mimetype },
      });
      blobStream.on("error", reject);
      blobStream.on("finish", resolve);
      blobStream.end(req.file.buffer);
    });

    const publicUrl = encodeURI(`https://storage.googleapis.com/${bucket.name}/${file.name}`);

    return sendSuccessResponse(res, 200, { url: publicUrl }, "File uploaded successfully");
  } catch (error) {
    console.error("Error while uploading image:", error);
    return sendErrorResponse(res, 500, "UPLOAD_FAILED", "Failed to upload file. Please try again.");
  }
};
