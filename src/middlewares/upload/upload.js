import multer from "multer";
import { sendErrorResponse } from "../response/responseHandler.js";

const FILE_SIZE_LIMIT = 10 * 1024 * 1024;

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_SIZE_LIMIT,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", `Unsupported file type: ${file.mimetype}`));
    }
  },
});

export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return sendErrorResponse(res, 413, "FILE_TOO_LARGE", `File size exceeds the ${FILE_SIZE_LIMIT / (1024 * 1024)}MB limit`);
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return sendErrorResponse(res, 400, "INVALID_FILE_TYPE", err.message);
    }
    return sendErrorResponse(res, 400, "UPLOAD_ERROR", err.message);
  }
  next(err);
};

export default uploadImage;
