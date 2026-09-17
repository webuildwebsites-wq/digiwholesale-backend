import express from "express";
import { uploadImageToBucket, uploadMultipleFilesToBucket } from "../../Utils/uploads/image.upload.bucket.js";
import uploadImage, { uploadMultipleFiles, handleMulterError } from "../../middlewares/upload/upload.js";

const imageUploadRouter = express.Router();

imageUploadRouter.post("/upload", uploadImage.single("image"), handleMulterError, uploadImageToBucket);
imageUploadRouter.post("/upload-multiple", uploadMultipleFiles.array("files", 10), handleMulterError, uploadMultipleFilesToBucket);

export default imageUploadRouter;
