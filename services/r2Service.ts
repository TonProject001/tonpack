import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Safely retrieve environment variables
const getEnv = () => {
    try {
        if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
            return (import.meta as any).env;
        }
        if (typeof process !== 'undefined' && process.env) {
            return process.env;
        }
    } catch (e) {}
    return {};
};

const env = getEnv();

const ACCOUNT_ID = env.VITE_R2_ACCOUNT_ID;
const ACCESS_KEY_ID = env.VITE_R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = env.VITE_R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = env.VITE_R2_BUCKET_NAME;
const PUBLIC_DOMAIN = env.VITE_R2_PUBLIC_DOMAIN; 

// Initialize S3 Client for Cloudflare R2
let r2Client: S3Client | null = null;

if (ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY) {
    r2Client = new S3Client({
        region: "auto",
        endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: ACCESS_KEY_ID,
            secretAccessKey: SECRET_ACCESS_KEY,
        },
    });
}

export const uploadVideoToR2 = async (
    videoBlob: Blob, 
    orderId: string, 
    onProgress?: (percentage: number) => void
): Promise<string> => {
    if (!r2Client) {
        throw new Error("R2 Client not configured.");
    }

    const fileName = `orders/${orderId}_${Date.now()}.webm`;
    
    // Fake progress starter
    if (onProgress) onProgress(10);

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: videoBlob,
        ContentType: "video/webm",
    });

    try {
        if (onProgress) onProgress(50);
        
        await r2Client.send(command);
        
        if (onProgress) onProgress(100);

        const finalUrl = PUBLIC_DOMAIN 
            ? `${PUBLIC_DOMAIN}/${fileName}`.replace(/([^:]\/)\/+/g, "$1") 
            : `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}/${fileName}`; 

        return finalUrl;
    } catch (error) {
        console.error("R2 Upload Error:", error);
        throw new Error("Failed to upload video to Cloudflare R2");
    }
};

export const isR2Configured = (): boolean => {
    return !!(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET_NAME);
};