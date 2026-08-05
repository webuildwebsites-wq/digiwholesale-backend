import multer from "multer";
import { sendErrorResponse } from "../../Utils/response/responseHandler.js";

const FILE_SIZE_LIMIT = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_SIZE_LIMIT,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
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
