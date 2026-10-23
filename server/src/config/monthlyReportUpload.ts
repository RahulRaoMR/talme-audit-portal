import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import multer from "multer";

export const monthlyReportUploadDirectory = path.resolve(process.cwd(), "uploads", "monthly-reports");
mkdirSync(monthlyReportUploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png"
]);

const storage = multer.diskStorage({
  destination: monthlyReportUploadDirectory,
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${randomUUID()}${extension}`);
  }
});

export const uploadMonthlyReportAttachments = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Only PDF, Word, Excel, PNG, and JPEG files are allowed"));
      return;
    }
    callback(null, true);
  }
}).array("files", 5);

