import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Cpu, Zap, Brain, MessageSquare, Settings, Eye, Trash2, Activity, Cloud, Server } from 'lucide-react';

// Safe accessor — returns undefined when running outside Electron
const getApi = () => (window as any).auraApi as Record<string, Function> | undefined;
const IS_ELECTRON = typeof (window as any).auraApi !== 'undefined';

const App: React.FC = () => {
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [visionContext, setVisionContext] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [tempKeys, setTempKeys] = useState({ assembly: '', openrouter: '' });
  const [isGhostMode, setIsGhostMode] = useState(false);
  
  const [provider, setProvider] = useState<'Cloud' | 'Local'>('Cloud');
  const [aiMode, setAiMode] = useState<'Turbo' | 'Genius'>('Turbo');
  const [persona, setPersona] = useState<'Technical' | 'SystemDesign' | 'Behavioral'>('Technical');
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [autoVision, setAutoVision] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const answerEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = getApi();

    if (!api) {
      console.warn('[Aura] Running in browser preview mode — Electron IPC not available.');
      return;
    }

    // Listen for transcripts from main process
    const cleanups = [
      api.onTranscript((data: { text: string, isFinal: boolean }) => {
        if (data.isFinal) {
          setTranscript(prev => [...prev.slice(-10), data.text]);
        }
      }),

      api.onAiThinking(() => {
        setIsThinking(true);
        setCurrentAnswer('');
      }),

      api.onAiAnswerChunk((chunk: string) => {
        setIsThinking(false);
        setCurrentAnswer(prev => prev + chunk);
      }),

      api.onAiAnswerEnd((fullAnswer: string) => {
        setAnswers(prev => [...prev, fullAnswer]);
        setCurrentAnswer('');
        setVisionContext(null);
      }),

      api.onVisionCaptured((base64: string) => {
        setVisionContext(`data:image/png;base64,${base64}`);
      }),

      api.onSettings(() => setShowSettings(true)),
      api.onSettingsStatus((data: { hasKeys: boolean }) => setHasKeys(data.hasKeys)),
      api.onSettingsSaved(() => {
        setShowSettings(false);
        api.getSettingsStatus();
      }),

      api.onInitCapture(() => {
        handleToggleCapture();
      }),

      api.onGhostModeToggle(() => {
        setIsGhostMode(prev => !prev);
      })
    ];

    api.getSettingsStatus();

    return () => {
      cleanups.forEach(fn => fn());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    answerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentAnswer, answers]);

  const toggleMode = () => {
    const next = aiMode === 'Turbo' ? 'Genius' : 'Turbo';
    setAiMode(next);
    getApi()?.setAiMode(next);
  };

  const toggleProvider = () => {
    const next = provider === 'Cloud' ? 'Local' : 'Cloud';
    setProvider(next);
    getApi()?.setAiProvider(next);
  };

  const cyclePersona = () => {
    const list: ('Technical' | 'SystemDesign' | 'Behavioral')[] = ['Technical', 'SystemDesign', 'Behavioral'];
    const idx = list.indexOf(persona);
    const next = list[(idx + 1) % list.length];
    setPersona(next);
    getApi()?.setAiPersona(next);
  };

  const toggleAutoVision = () => {
    const next = !autoVision;
    setAutoVision(next);
    getApi()?.setAutoVision(next);
  };

  const clearAll = () => {
    setTranscript([]);
    setAnswers([]);
    setCurrentAnswer('');
    setVisionContext(null);
  };

  const handleCapture = () => {
    if (!IS_ELECTRON) return;
    if (!hasKeys) {
      setShowSettings(true);
      return;
    }
    getApi()?.captureScreen();
  };

  const handleSaveSettings = () => {
    getApi()?.saveSettings(tempKeys);
  };

  const handleToggleCapture = async () => {
    if (isCapturing) {
      stopCapture();
    } else {
      await startCapture();
    }
  };

  const startCapture = async () => {
    if (!IS_ELECTRON) {
      console.warn('[Aura] Audio capture requires Electron');
      return;
    }
    try {
      // Trigger the stealth capture in Main process first (setDisplayMediaRequestHandler)
      getApi()?.startAudioCapture();

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required for getDisplayMedia, but we'll ignore it
        audio: true
      });

      streamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Offload conversion math to the backend Node thread to prevent UI stutter
        getApi()?.sendAudioChunk(inputData);
      };

      setIsCapturing(true);
      console.log('[Aura] Audio capture started');
    } catch (err) {
      console.error('[Aura] Failed to start capture:', err);
    }
  };

  const stopCapture = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    audioContextRef.current?.close();
    getApi()?.stopAudioCapture();
    setIsCapturing(false);
    console.log('[Aura] Audio capture stopped');
  };

  const handleClose = () => {
    getApi()?.closeApp();
  };

  const hasContent = showSettings || transcript.length > 0 || answers.length > 0 || currentAnswer || isThinking || isCapturing || autoVision;

  return (
    <div className={`app-wrapper ${isGhostMode ? 'ghost-mode' : ''}`}>
      <header className="ribbon-container">
        <div className="drag-handle"></div>
        <div className="title-group">
          <h1 className="title">Aura</h1>
          <span className="persona-badge" onClick={cyclePersona}>
            {persona}
          </span>
        </div>
        <div className="controls">
          <button 
            className="control-btn" 
            onClick={toggleProvider}
            title={`Provider: ${provider} Mode`}
          >
            {provider === 'Cloud' ? <Cloud size={14} color="var(--accent-cyan)" /> : <Server size={14} color="var(--accent-violet)" />}
          </button>
          <button 
            className={`mode-btn ${aiMode.toLowerCase()}`} 
            onClick={toggleMode}
            title={`Switch to ${aiMode === 'Turbo' ? 'Genius' : 'Turbo'}`}
          >
            {aiMode === 'Turbo' ? <Zap size={14} /> : <Brain size={14} />}
            {aiMode}
          </button>
          <button 
            className={`control-btn ${autoVision ? 'active' : ''}`} 
            onClick={toggleAutoVision}
            title="Auto-Vision: Proactively sync screen context"
          >
            <Activity size={16} color={autoVision ? 'var(--accent-cyan)' : 'white'} />
          </button>
          <button 
            className="control-btn" 
            onClick={handleCapture}
            title="Vision: Manual Screen Capture"
          >
            <Eye size={16} />
          </button>
          <button 
            className="control-btn" 
            onClick={clearAll}
            title="Clear History"
          >
            <Trash2 size={16} />
          </button>
          <button 
            className="control-btn" 
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button className="control-btn close" onClick={handleClose}>×</button>
        </div>
      </header>

      {hasContent && (
        <main className="insight-window">
        {showSettings && (
          <div className="settings-overlay">
            <h3 style={{color: 'var(--accent-cyan)', marginBottom: '16px'}}>Configuration</h3>
            <div className="input-group">
              <label>AssemblyAI API Key</label>
              <input 
                type="password" 
                placeholder="Paste key here..."
                value={tempKeys.assembly}
                onChange={(e) => setTempKeys({...tempKeys, assembly: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label>OpenRouter API Key</label>
              <input 
                type="password" 
                placeholder="Paste key here..."
                value={tempKeys.openrouter}
                onChange={(e) => setTempKeys({...tempKeys, openrouter: e.target.value})}
              />
            </div>
            <button className="save-btn" onClick={handleSaveSettings}>Save & Encrypt</button>
            <p className="hint">Keys are encrypted using Windows SafeStorage.</p>
          </div>
        )}

        {!showSettings && (
          <>
            <div className="transcript-area">
              {transcript.length === 0 && !isCapturing && <p className="text-secondary">Ready for interview...</p>}
              {transcript.map((line, i) => (
                <p key={i} className="transcript-line">{line}</p>
              ))}
            </div>

            <div className="answers-container">
              {answers.map((ans, i) => (
                <div key={i} className="answer-card">
                  <ReactMarkdown>{ans}</ReactMarkdown>
                </div>
              ))}
              
              {isThinking && (
                <div className="answer-card thinking">
                  <div className="pulse"></div>
                  <span>Aura is thinking...</span>
                  {visionContext && (
                    <img src={visionContext} alt="Vision Context" className="vision-thumbnail" />
                  )}
                </div>
              )}

              {currentAnswer && (
                <div className="answer-card live">
                  {visionContext && (
                    <img src={visionContext} alt="Vision Context" className="vision-thumbnail" />
                  )}
                  <ReactMarkdown>{currentAnswer}</ReactMarkdown>
                </div>
              )}
              <div ref={answerEndRef} />
            </div>
          </>
        )}

        {!showSettings && (
          <footer className="status-bar">
            <div className={`status-item ${isCapturing ? 'active' : ''}`}>
              <Cpu size={12} />
              <span>STT: {isCapturing ? 'Listening' : 'Idle'}</span>
            </div>
            <div className={`status-item ${autoVision ? 'active' : ''}`}>
              <Activity size={12} />
              <span>Auto-Vision: {autoVision ? 'Linked' : 'Off'}</span>
            </div>
            <div className="status-item active">
              <MessageSquare size={12} />
              <span>LLM: {aiMode}</span>
            </div>
          </footer>
        )}
      </main>
      )}
    </div>
  );
};

export default App;
