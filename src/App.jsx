import React, { useRef, useEffect, useState } from 'react';
import { Mic, Upload, Square, X, Minus } from 'lucide-react';

// --- PHẦN 1: HÀM GỌI TAURI AN TOÀN (Cho phép chạy trên Web không lỗi) ---
// Thử import từ tauri, nếu không có (trên web) thì dùng hàm giả
let invoke;
try {
  // Dùng require động hoặc kiểm tra window để tránh lỗi build trên môi trường không có Tauri
  if (window.__TAURI__) {
      invoke = window.__TAURI__.core.invoke;
  } else {
      invoke = (cmd) => console.log(`[Web Mock] Invoke command: ${cmd}`);
  }
} catch (e) {
  invoke = (cmd) => console.log(`[Web Mock] Invoke command: ${cmd}`);
}

// --- PHẦN 2: COMPONENT TITLEBAR ---
const TitleBar = () => {
  const handleMinimize = () => {
    if (invoke) invoke('minimize_app');
  };

  const handleClose = () => {
    if (invoke) invoke('close_app');
  };

  return (
    <div 
      data-tauri-drag-region 
      className="fixed top-0 left-0 right-0 h-8 flex justify-between items-center bg-white/5 backdrop-blur-md border-b border-white/10 z-50 select-none"
    >
      <div className="flex items-center gap-2 px-3 pointer-events-none">
        <span className="text-lg">🎵</span>
        <span className="text-xs font-medium text-gray-300">Nebula Player</span>
      </div>

      <div className="flex h-full">
        <button 
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <Minus size={16} />
        </button>
        <button 
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center hover:bg-red-500 text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

// --- PHẦN 3: COMPONENT NEBULA VISUALIZER ---
const NebulaVisualizer = () => {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isRunning, setIsRunning] = useState(false);
  const [sourceType, setSourceType] = useState(null);
  const [songTitle, setSongTitle] = useState('');
  
  const NUM_BARS = 120;
  const BASE_RADIUS = 120; 
  
  const barHeightsRef = useRef(new Array(NUM_BARS).fill(0));
  const particlesRef = useRef([]);
  const beatRef = useRef(0);

  useEffect(() => {
    initParticles();
    return () => stopVisualizer();
  }, []);

  const initParticles = () => {
    const particles = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 2 + 0.5,
        opacity: Math.random(),
        color: `hsl(${Math.random() * 360}, 70%, 70%)`
      });
    }
    particlesRef.current = particles;
  };

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 4096;
      analyserRef.current.smoothingTimeConstant = 0.85;
    }
  };

  const startMic = async () => {
    try {
      stopVisualizer();
      initAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      setSourceType('mic');
      setSongTitle('Live Microphone Input');
      setIsRunning(true);
      draw();
    } catch (err) {
      alert("Lỗi Micro: " + err.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setSongTitle(file.name.replace(/\.[^/.]+$/, ""));
    stopVisualizer();
    initAudio();

    const reader = new FileReader();
    reader.onload = async (event) => {
      const audioData = event.target.result;
      const buffer = await audioContextRef.current.decodeAudioData(audioData);
      
      const bufferSource = audioContextRef.current.createBufferSource();
      bufferSource.buffer = buffer;
      bufferSource.loop = true;
      
      bufferSource.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      
      sourceRef.current = bufferSource;
      bufferSource.start(0);
      
      setSourceType('file');
      setIsRunning(true);
      draw();
    };
    reader.readAsArrayBuffer(file);
  };

  const stopVisualizer = () => {
    if (sourceRef.current) {
      if (sourceRef.current.stop) try { sourceRef.current.stop(); } catch(e){}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsRunning(false);
    
    const canvas = canvasRef.current;
    if(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const draw = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const width = 600;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for(let i = 0; i < 20; i++) sum += dataArray[i]; 
    const averageBass = sum / 20;
    
    const isBassKick = averageBass > 180;
    if (isBassKick) beatRef.current = 10; 
    else if (beatRef.current > 0) beatRef.current *= 0.9;

    ctx.fillStyle = 'rgba(5, 16, 30, 0.3)'; 
    ctx.fillRect(0, 0, width, height);

    particlesRef.current.forEach(p => {
      p.y -= p.speed * (isBassKick ? 3 : 1);
      if (p.y < 0) {
        p.y = height;
        p.x = Math.random() * width;
      }
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    const gradient = ctx.createLinearGradient(0, centerY - 200, 0, centerY + 200);
    gradient.addColorStop(0, '#00f260'); 
    gradient.addColorStop(0.5, '#0575E6'); 
    gradient.addColorStop(1, '#8E2DE2'); 

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = gradient;
    ctx.shadowBlur = isBassKick ? 20 : 10;
    ctx.shadowColor = '#0575E6';

    const step = Math.floor(bufferLength / NUM_BARS / 3); 
    const currentRadius = BASE_RADIUS + beatRef.current * 1.5;

    for (let i = 0; i < NUM_BARS; i++) {
        const rawValue = dataArray[i * step];
        
        if (rawValue > barHeightsRef.current[i]) {
            barHeightsRef.current[i] = rawValue;
        } else {
            barHeightsRef.current[i] = Math.max(barHeightsRef.current[i] * 0.92, 0);
        }

        const value = barHeightsRef.current[i];
        const normalizedAmp = value / 255;
        const barHeight = normalizedAmp * 100;

        const angle = (2 * Math.PI * i) / NUM_BARS - Math.PI / 2;

        const innerX = centerX + currentRadius * Math.cos(angle);
        const innerY = centerY + currentRadius * Math.sin(angle);
        
        const outerX = centerX + (currentRadius + barHeight) * Math.cos(angle);
        const outerY = centerY + (currentRadius + barHeight) * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.lineTo(outerX, outerY);
        ctx.stroke();
    }

    ctx.save();
    ctx.translate(centerX, centerY);
    const time = Date.now() / 3000;
    ctx.rotate(time);
    
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius - 10, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.rotate(-time); 
    if (isRunning) {
        ctx.fillStyle = `hsl(${(Date.now() / 20) % 360}, 70%, 60%)`;
        ctx.font = `${30 + beatRef.current}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♫', 0, 5); 
    }
    ctx.restore();

    animationRef.current = requestAnimationFrame(draw);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050510] text-white p-4 overflow-hidden font-sans select-none">
      
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      <div className="z-10 flex flex-col items-center w-full max-w-2xl" data-tauri-drag-region>
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent tracking-widest drop-shadow-lg">
          NEBULA VISUALIZER
        </h1>

        <div className="relative mb-8 group">
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            className="rounded-full shadow-2xl shadow-blue-500/10 border border-white/5 bg-white/5 backdrop-blur-sm"
          />
          
          {!isRunning && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full backdrop-blur-sm transition-opacity">
                <span className="text-gray-300 font-light tracking-wide">Chọn nguồn nhạc để bắt đầu</span>
             </div>
          )}
          
          {isRunning && songTitle && (
            <div className="absolute bottom-10 left-0 w-full text-center">
                <p className="text-white/80 font-medium text-lg drop-shadow-md truncate px-10">{songTitle}</p>
            </div>
          )}
        </div>

        <div className="flex gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl transition-all hover:bg-white/10">
          <button
            onClick={startMic}
            className={`relative overflow-hidden flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 active:scale-95 ${
              sourceType === 'mic' && isRunning
                ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg shadow-red-500/30 ring-2 ring-red-400/50'
                : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300'
            }`}
          >
            <Mic size={20} />
            <span>Mic Input</span>
          </button>

          <div className="relative">
              <input 
                  type="file" 
                  accept="audio/*" 
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileUpload}
              />
              <button
              onClick={() => fileInputRef.current.click()}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 active:scale-95 ${
                  sourceType === 'file' && isRunning
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/50'
                  : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300'
              }`}
              >
              <Upload size={20} />
              <span>Phát File</span>
              </button>
          </div>

          {isRunning && (
            <button
              onClick={stopVisualizer}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-700 hover:bg-red-500/80 text-white font-bold transition-all active:scale-95"
            >
              <Square size={20} fill="currentColor" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- PHẦN 4: COMPONENT APP CHÍNH ---
function App() {
  return (
    <div className="relative">
      {/* 1. Nhét thanh tiêu đề vào đây */}
      <TitleBar />

      {/* 2. Nội dung chính (cần padding-top để không bị titlebar che) */}
      <div className="pt-8 h-screen bg-[#050510]">
        <NebulaVisualizer />
      </div>
    </div>
  );
}

export default App;