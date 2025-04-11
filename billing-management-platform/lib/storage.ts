import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function uploadToStorage(
  buffer: Buffer,
  key: string,
  contentType: string = "application/pdf"
): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET || "";
  
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  
  // Generate a signed URL that expires in 7 days
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 });
  
  return signedUrl;
}

export function generateStorageKey(invoiceNumber: string): string {
  const timestamp = new Date().toISOString().split("T")[0];
  return `invoices/${timestamp}/${invoiceNumber}.pdf`;
} 