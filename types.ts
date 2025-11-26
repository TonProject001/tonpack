export interface PackingRecord {
  id?: number;
  orderId: string;
  timestamp: number;
  videoBlob: Blob;
  duration: number;
  aiAnalysis?: string; // Result from Gemini
  isFlagged: boolean;
  publicUrl?: string; // The link for the customer
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed';
  r2Key?: string; // The file path in Cloudflare
}

export enum AppMode {
  PACKING = 'PACKING',
  DASHBOARD = 'DASHBOARD'
}

export enum RecorderState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  UPLOADING = 'UPLOADING', // New state for cloud upload simulation
  COMPLETED = 'COMPLETED'
}