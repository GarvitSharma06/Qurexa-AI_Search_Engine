import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { motion, AnimatePresence } from "motion/react";
import { Camera, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

interface FaceGateProps {
  onVerified: (age: number) => void;
}

export function FaceGate({ onVerified }: FaceGateProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "detecting" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [detectedAges, setDetectedAges] = useState<number[]>([]);
  const [currentAge, setCurrentAge] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

  useEffect(() => {
    const loadModels = async () => {
      try {
        setStatus("loading");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
        ]);
        setStatus("ready");
        startVideo();
      } catch (err) {
        console.error("Failed to load models:", err);
        setError("Failed to load AI models. Please check your internet connection.");
        setStatus("error");
      }
    };
    loadModels();
  }, []);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("Camera access denied. Qurexa requires camera for age verification.");
      setStatus("error");
    }
  };

  const handleDetect = async () => {
    if (!videoRef.current) return;
    setStatus("detecting");
    setTimeLeft(20);
    
    let samples: number[] = [];
    const detectionInterval = setInterval(async () => {
      if (!videoRef.current) return;
      
      const detections = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withAgeAndGender();

      if (detections) {
        const age = Math.round(detections.age);
        samples.push(age);
        setCurrentAge(age);
        
        if (samples.length >= 5) {
          clearInterval(detectionInterval);
          clearInterval(timerInterval);
          // Average age to reduce variance
          const averageAge = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
          onVerified(averageAge);
        }
      }
    }, 1000);

    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(detectionInterval);
          clearInterval(timerInterval);
          // Default to restricted mode (age 17) if timeout reached
          onVerified(17);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl text-center"
      >
        <div className="mb-6 flex justify-center">
          <div className="p-4 bg-blue-500/10 rounded-full">
            <ShieldCheck className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Qurexa Verification</h1>
        <p className="text-zinc-400 mb-8">
          Please verify your identity to start searching. We use AI to estimate your age for a safer experience.
        </p>

        <div className="relative aspect-video mb-8 bg-black rounded-2xl overflow-hidden border border-zinc-800">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            className="w-full h-full object-cover"
          />
          <AnimatePresence>
            {status === "detecting" && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
              >
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                <p className="text-white font-medium">Analyzing face...</p>
                {timeLeft !== null && (
                  <p className="text-zinc-400 text-sm mt-1">Time remaining: {timeLeft}s</p>
                )}
                {currentAge !== null && (
                  <p className="text-blue-400 text-sm mt-2">Estimated: {currentAge}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {status === "error" ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6 flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        ) : (
          <button
            onClick={handleDetect}
            disabled={status !== "ready"}
            className={cn(
              "w-full py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
              status === "ready" 
                ? "bg-blue-600 hover:bg-blue-500 text-white" 
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            {status === "loading" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading AI Models...
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                Verify Identity
              </>
            )}
          </button>
        )}

        <p className="mt-6 text-xs text-zinc-500">
          By continuing, you agree to our privacy policy. Face data is processed locally and never stored.
        </p>
      </motion.div>
    </div>
  );
}
