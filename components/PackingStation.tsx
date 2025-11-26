import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, StopCircle, RefreshCw, CheckCircle, ScanLine, Play, Box, CloudUpload, Link as LinkIcon, ExternalLink, AlertTriangle } from 'lucide-react';
import { RecorderState } from '../types';
import { db } from '../services/db';
import { analyzePackageImage } from '../services/geminiService';
import { uploadVideoToR2, isR2Configured } from '../services/r2Service';

export const PackingStation: React.FC = () => {
  // Logic State
  const [inputValue, setInputValue] = useState(''); // Controls the input field
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null); // Stores the ID currently being recorded
  
  const [recorderState, setRecorderState] = useState<RecorderState>(RecorderState.IDLE);
  const [duration, setDuration] = useState(0);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Independent Timer Effect
  useEffect(() => {
    let interval: number;
    
    if (recorderState === RecorderState.RECORDING) {
      interval = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recorderState]);

  // 2. Camera Initialization & Focus Management
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          // Requested 720p resolution
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: true 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        // Don't alert immediately on load, only log
      }
    };
    startCamera();

    const focusInterval = setInterval(() => {
      if (recorderState !== RecorderState.COMPLETED && document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 1000);

    return () => {
      clearInterval(focusInterval);
    };
  }, [recorderState]);

  const startRecording = useCallback((idToRecord: string) => {
    if (!videoRef.current?.srcObject) return;

    const stream = videoRef.current.srcObject as MediaStream;
    
    // Optimize for storage: 1 Mbps bitrate is sufficient for 720p documentation
    const options: MediaRecorderOptions = {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 1000000 
    };

    const mediaRecorder = MediaRecorder.isTypeSupported(options.mimeType!) 
        ? new MediaRecorder(stream, options) 
        : new MediaRecorder(stream);
    
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      await saveRecord(blob, idToRecord, duration);
    };

    mediaRecorder.start();
    
    setActiveOrderId(idToRecord);
    setRecorderState(RecorderState.RECORDING);
    setDuration(0);

  }, [duration]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecorderState(RecorderState.PROCESSING);
      
      // Capture frame for AI Analysis
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        
        analyzePackageImage(base64).then(setLastAnalysis);
      }
    }
  }, []);

  const saveRecord = async (blob: Blob, id: string, finalDuration: number) => {
    try {
      setRecorderState(RecorderState.UPLOADING);
      setUploadProgress(0);
      setUploadError(null);
      let publicUrl = '';
      let status: 'completed' | 'failed' = 'completed';

      // 1. R2 Real Upload
      if (isR2Configured()) {
          try {
              publicUrl = await uploadVideoToR2(blob, id, (progress) => {
                  setUploadProgress(progress);
              });
          } catch (err) {
              console.error("R2 Upload Failed:", err);
              setUploadError("Cloud upload failed. Saved locally only.");
              status = 'failed';
              publicUrl = ''; // No URL if upload failed
          }
      } else {
          // Fallback to simulation if keys are missing
          console.warn("R2 Keys missing. Simulating upload.");
          publicUrl = await new Promise((resolve) => {
             let p = 0;
             const i = setInterval(() => {
                 p += 20;
                 setUploadProgress(p);
                 if(p >= 100) {
                     clearInterval(i);
                     resolve(`https://demo-mode.dobybot-clone.com/v/${id}`);
                 }
             }, 200);
          });
      }

      setGeneratedLink(publicUrl);

      // 2. Save to Local Database (Mock Server DB)
      await db.records.add({
        orderId: id,
        timestamp: Date.now(),
        videoBlob: blob,
        duration: finalDuration, 
        isFlagged: false,
        aiAnalysis: "Processing...",
        uploadStatus: status,
        publicUrl: publicUrl
      });
      
      setTimeout(async () => {
         const lastRec = await db.records.orderBy('id').last();
         if(lastRec && lastAnalysis) {
             await db.records.update(lastRec.id!, { aiAnalysis: lastAnalysis });
         }
      }, 2000);

      setRecorderState(RecorderState.COMPLETED);
    } catch (error) {
      console.error("Failed to save record:", error);
      alert("Error saving recording.");
      setRecorderState(RecorderState.IDLE);
    }
  };

  const resetStation = () => {
    setInputValue('');
    setActiveOrderId(null);
    setDuration(0);
    setLastAnalysis(null);
    setGeneratedLink(null);
    setUploadProgress(0);
    setUploadError(null);
    setRecorderState(RecorderState.IDLE);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // 3. Updated Barcode Logic
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const scannedValue = inputValue.trim();
      if (!scannedValue) return;

      if (recorderState === RecorderState.IDLE) {
        startRecording(scannedValue);
        setInputValue(''); 
      } else if (recorderState === RecorderState.RECORDING) {
        if (scannedValue === activeOrderId) {
            stopRecording();
            setInputValue('');
        } else {
            alert(`Incorrect closing barcode. \nExpected: ${activeOrderId}\nScanned: ${scannedValue}`);
            setInputValue(''); 
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-4 gap-4">
      {/* Top Bar: Status & Controls */}
      <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700">
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${recorderState === RecorderState.RECORDING ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`}>
                {recorderState === RecorderState.RECORDING ? <Camera className="w-6 h-6 text-white" /> : <Box className="w-6 h-6 text-slate-400" />}
            </div>
            <div>
                <h2 className="text-xl font-bold tracking-tight">Station #01</h2>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${recorderState === RecorderState.RECORDING ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    {recorderState === RecorderState.RECORDING 
                        ? <span className="text-red-400 font-bold">RECORDING: {activeOrderId}</span> 
                        : 'READY TO PACK'}
                </div>
            </div>
        </div>

        <div className="flex items-center gap-6">
            <div className="text-right">
                <p className="text-xs text-slate-400 uppercase font-semibold">Duration</p>
                <p className={`text-3xl font-mono font-bold ${recorderState === RecorderState.RECORDING ? 'text-red-500' : 'text-slate-500'}`}>
                    {new Date(duration * 1000).toISOString().substr(11, 8)}
                </p>
            </div>
            
            <div className="flex flex-col w-72">
                <label className="text-xs text-slate-400 mb-1 font-semibold uppercase">
                    {recorderState === RecorderState.RECORDING ? `Scan "${activeOrderId}" to Stop` : 'Scan Order ID to Start'}
                </label>
                <div className="relative">
                    <ScanLine className={`absolute left-3 top-2.5 w-5 h-5 ${recorderState === RecorderState.RECORDING ? 'text-red-500' : 'text-slate-500'}`} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        disabled={recorderState === RecorderState.PROCESSING || recorderState === RecorderState.UPLOADING || recorderState === RecorderState.COMPLETED}
                        placeholder={recorderState === RecorderState.RECORDING ? "Scan same barcode..." : "Scan Order ID..."}
                        className={`w-full bg-slate-950 border rounded-lg py-2 pl-10 pr-4 focus:ring-2 focus:outline-none text-white font-mono placeholder-slate-600 ${recorderState === RecorderState.RECORDING ? 'border-red-900 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'}`}
                    />
                </div>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-4 min-h-0">
        
        {/* Left: Camera Feed */}
        <div className="flex-1 bg-black rounded-xl overflow-hidden relative shadow-2xl border border-slate-800">
            <video 
                ref={videoRef} 
                autoPlay 
                muted 
                className="w-full h-full object-cover"
            />
            
            {/* Overlay UI: Recording */}
            {recorderState === RecorderState.RECORDING && (
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600/90 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    REC
                </div>
            )}

            {/* Overlay UI: Uploading */}
            {recorderState === RecorderState.UPLOADING && (
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center">
                    <CloudUpload className="w-16 h-16 text-blue-500 animate-bounce mb-4" />
                    <h3 className="text-2xl font-bold text-white mb-2">Uploading to Cloud...</h3>
                    <div className="w-64 bg-slate-700 rounded-full h-2.5 dark:bg-slate-700 mt-2">
                        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p className="text-slate-400 mt-2 font-mono">{uploadProgress}%</p>
                </div>
            )}
            
            {/* Overlay UI: Completed */}
            {recorderState === RecorderState.COMPLETED && (
                <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                    <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-lg w-full shadow-2xl">
                        <div className="flex flex-col items-center text-center mb-6">
                            {uploadError ? (
                                <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
                            ) : (
                                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                            )}
                            
                            <h3 className="text-2xl font-bold text-white">
                                {uploadError ? "Saved Locally Only" : "Ready to Send!"}
                            </h3>
                            <p className="text-slate-400">Order <span className="text-white font-mono">{activeOrderId}</span> has been processed.</p>
                            {uploadError && <p className="text-red-400 text-xs mt-2">{uploadError}</p>}
                        </div>

                        {/* Public Link Box (Only if no error) */}
                        {!uploadError && generatedLink && (
                            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 mb-6 flex flex-col gap-2">
                                <label className="text-xs text-slate-500 uppercase font-semibold flex items-center gap-1">
                                    <LinkIcon className="w-3 h-3" /> Customer Tracking Link
                                </label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-blue-400 text-sm truncate font-mono bg-slate-900 p-2 rounded border border-slate-800">
                                        {generatedLink}
                                    </code>
                                    <button 
                                        onClick={() => {navigator.clipboard.writeText(generatedLink || '')}}
                                        className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded text-xs font-bold transition-colors"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {lastAnalysis && (
                            <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/20 mb-8">
                                <h4 className="text-blue-400 text-xs font-bold uppercase mb-1 flex items-center gap-2">
                                    <span className="text-sm">✨</span> AI Note
                                </h4>
                                <p className="text-slate-300 text-sm italic">"{lastAnalysis}"</p>
                            </div>
                        )}

                        <button 
                            onClick={resetStation}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold transition-all transform hover:scale-[1.02] shadow-lg shadow-blue-900/50"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Pack Next Order
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Right: Instructions / Controls */}
        <div className="w-80 bg-slate-800 rounded-xl p-6 flex flex-col gap-6 border border-slate-700">
            <div className="space-y-4">
                <h3 className="font-bold text-lg text-slate-200 border-b border-slate-700 pb-2">Workflow</h3>
                <div className={`p-4 rounded-lg border transition-all ${recorderState === RecorderState.IDLE ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-700/30 border-transparent opacity-50'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">1</span>
                        <span className="font-semibold text-blue-100">Scan Barcode</span>
                    </div>
                    <p className="text-xs text-slate-400 pl-9">Scan the shipping label to initialize the system.</p>
                </div>

                <div className={`p-4 rounded-lg border transition-all ${recorderState === RecorderState.RECORDING ? 'bg-red-900/20 border-red-500/50' : 'bg-slate-700/30 border-transparent opacity-50'}`}>
                     <div className="flex items-center gap-3 mb-2">
                        <span className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-xs font-bold">2</span>
                        <span className="font-semibold text-red-100">Pack & Record</span>
                    </div>
                    <p className="text-xs text-slate-400 pl-9">Video records automatically. Ensure label is visible.</p>
                </div>

                <div className={`p-4 rounded-lg border transition-all ${recorderState === RecorderState.COMPLETED ? 'bg-green-900/20 border-green-500/50' : 'bg-slate-700/30 border-transparent opacity-50'}`}>
                     <div className="flex items-center gap-3 mb-2">
                        <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold">3</span>
                        <span className="font-semibold text-green-100">Finish & Upload</span>
                    </div>
                    <p className="text-xs text-slate-400 pl-9">Scan <span className="text-white font-bold">SAME</span> barcode to stop & auto-upload.</p>
                </div>
            </div>

            <div className="mt-auto">
                <div className="mb-4">
                     {!isR2Configured() && (
                         <div className="flex items-start gap-2 text-xs text-yellow-500 bg-yellow-900/20 p-2 rounded border border-yellow-700/50">
                             <AlertTriangle className="w-4 h-4 shrink-0" />
                             <span>R2 Keys not found. Using simulation mode.</span>
                         </div>
                     )}
                </div>

                {recorderState === RecorderState.RECORDING ? (
                    <button 
                        onClick={stopRecording}
                        className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 transition-all"
                    >
                        <StopCircle className="w-6 h-6" /> Stop (Or Scan)
                    </button>
                ) : recorderState === RecorderState.IDLE ? (
                    <button 
                        disabled 
                        className="w-full bg-slate-700 text-slate-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-not-allowed opacity-50"
                    >
                        <Play className="w-6 h-6" /> Scan to Start
                    </button>
                ) : (
                   <button disabled className="w-full bg-slate-700 text-slate-400 py-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-wait">
                        Processing...
                   </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};