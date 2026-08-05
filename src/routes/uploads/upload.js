import express from "express";
import { uploadImageToBucket } from "../../Utils/uploads/image.upload.bucket.js";
import uploadImage, { handleMulterError } from "../../middlewares/upload/upload.js";

const imageUploadRouter = express.Router();

imageUploadRouter.post("/upload", uploadImage.single("image"), handleMulterError, uploadImageToBucket);

export default imageUploadRouter;
