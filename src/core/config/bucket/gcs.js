import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

// Google Cloud Storage automatically picks up credentials from GOOGLE_APPLICATION_CREDENTIALS via ADC.
// Omitting deprecated `keyFilename` prevents google-auth-library deprecation warnings.
const storageOptions = {};
if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
  storageOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
}

const storage = new Storage(storageOptions);

const bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET_NAME);

export { bucket };
