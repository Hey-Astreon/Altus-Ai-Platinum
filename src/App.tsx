import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Cpu, Zap, Brain, MessageSquare, Settings, Eye, Trash2, Activity, Cloud, Server, ChevronRight, Mic, Keyboard, Layers } from 'lucide-react';
import { MODEL_REGISTRY } from './constants/models';

// Safe accessor — returns undefined when running outside Electron
const getApi = () => (window as any).altusApi as Record<string, Function> | undefined;
const IS_ELECTRON = typeof (window as any).altusApi !== 'undefined';

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
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [appOpacity, setAppOpacity] = useState(0.85);
  const [error, setError] = useState<string | null>(null);
  const [isFlaring, setIsFlaring] = useState(false);
  const [isCapturingVision, setIsCapturingVision] = useState(false);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-3.5-sonnet');
  const [hotkeys, setHotkeys] = useState({
    toggleVisibility: 'CommandOrControl+Shift+V',
    visionCapture: 'CommandOrControl+Shift+S'
  });
  const [isRecordingHotkey, setIsRecordingHotkey] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const answerEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = getApi();

    if (!api) {
      console.warn('[Altus AI] Running in browser preview mode — Electron IPC not available.');
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
        setIsThinking(false);
        setAnswers(prev => [...prev, fullAnswer]);
        setCurrentAnswer('');
        setVisionContext(null);
      }),

      api.onAiError((msg: string) => {
        setIsThinking(false);
        setError(msg);
        setTimeout(() => setError(null), 5000);
      }),

      api.onVisionCaptured((base64: string) => {
        setVisionContext(`data:image/png;base64,${base64}`);
      }),

      api.onSettings(() => setShowSettings(true)),
      api.onSettingsStatus((data: { hasKeys: boolean, opacity: number, selectedModel?: string, selectedDeviceId?: string, hotkeys?: any }) => {
        setHasKeys(data.hasKeys);
        if (data.opacity) setAppOpacity(data.opacity);
        if (data.selectedModel) setSelectedModel(data.selectedModel);
        if (data.selectedDeviceId) setSelectedDevice(data.selectedDeviceId);
        if (data.hotkeys) setHotkeys(data.hotkeys);
      }),
      api.onSettingsSaved(() => {
        setShowSettings(false);
        api.getSettingsStatus();
      }),

      api.onInitCapture(() => {
        handleToggleCapture();
      }),

      api.onGhostModeToggle(() => {
        setIsGhostMode(prev => !prev);
      }),

      api.onCalibrationComplete(() => {
        setIsCalibrated(true);
      })
    ];

    api.getSettingsStatus();
    loadAudioDevices();

    // Hardware Hot-Plug Detection
    navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices);

    // Initial Opacity Sync (Avoid React render cycle)
    document.documentElement.style.setProperty('--app-opacity', appOpacity.toString());

    return () => {
      cleanups.forEach(fn => fn());
      navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
    } catch (e) {
      console.error('Failed to load audio devices:', e);
    }
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    getApi()?.setModel(modelId);
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId);
    getApi()?.setDevice(deviceId);
  };

  const recordHotkey = (type: string) => {
    setIsRecordingHotkey(type);
  };

  useEffect(() => {
    if (!isRecordingHotkey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const keys = [];
      if (e.ctrlKey || e.metaKey) keys.push('CommandOrControl');
      if (e.shiftKey) keys.push('Shift');
      if (e.altKey) keys.push('Alt');
      
      // Filter out modifier-only presses
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        keys.push(e.key.toUpperCase());
        const hotkeyString = keys.join('+');
        
        getApi()?.updateHotkey(isRecordingHotkey, hotkeyString);
        setHotkeys(prev => ({ ...prev, [isRecordingHotkey]: hotkeyString }));
        setIsRecordingHotkey(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecordingHotkey]);

  useEffect(() => {
    // Optimization: Use requestAnimationFrame for smoother scrolling under load
    const scrollTimer = requestAnimationFrame(() => {
      answerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(scrollTimer);
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

  const handleSaveSettings = () => {
    if (!tempKeys.assembly || !tempKeys.openrouter) {
      alert('Please provide both API keys.');
      return;
    }
    getApi()?.saveSettings(tempKeys);
    getApi()?.setModel(selectedModel);
    getApi()?.setDevice(selectedDevice);
  };

  const handleCapture = () => {
    if (!IS_ELECTRON) return;
    if (!hasKeys) {
      setShowSettings(true);
      return;
    }
    getApi()?.captureScreen();
  };


  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setAppOpacity(val);
    // Hardening: Direct DOM injection skips the heavy React reconciliation for the whole window
    document.documentElement.style.setProperty('--app-opacity', val.toString());
    getApi()?.setOpacity(val);
  };

  // Trigger High-Tech Flare when AI finishes thinking
  const prevThinking = useRef(isThinking);
  useEffect(() => {
    if (prevThinking.current === true && isThinking === false) {
      setIsFlaring(true);
      setTimeout(() => setIsFlaring(false), 300);
    }
    prevThinking.current = isThinking;
  }, [isThinking]);

  const handleToggleCapture = async () => {
    if (isCapturing) {
      stopCapture();
    } else {
      setIsCalibrated(false); // Reset calibration state when starting new session
      await startCapture();
    }
  };

  const handleExport = () => {
    getApi()?.exportSession({ answers, transcript });
  };

  const startCapture = async () => {
    if (!IS_ELECTRON) {
      console.warn('[Altus AI] Audio capture requires Electron');
      return;
    }
    try {
      // Create audio context and request mic stream
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      const constraints: MediaStreamConstraints = {
        audio: selectedDevice === 'default' ? true : { deviceId: { exact: selectedDevice } }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      
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
      console.log('[Altus AI] Audio capture started');
    } catch (err) {
      console.error('[Altus AI] Failed to start capture:', err);
    }
  };

  const stopCapture = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    audioContextRef.current?.close();
    getApi()?.stopAudioCapture();
    setIsCapturing(false);
    console.log('[Altus AI] Audio capture stopped');
  };

  const handleClose = () => {
    getApi()?.closeApp();
  };

  const hasContent = showSettings || transcript.length > 0 || answers.length > 0 || currentAnswer || isThinking || isCapturing || autoVision;

  return (
    <div 
      className={`app-wrapper ${isGhostMode ? 'ghost-mode' : ''} ${isFlaring ? 'flare-pulse' : ''}`}
      style={{ '--app-opacity': appOpacity } as React.CSSProperties}
    >
      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}
      {isCapturing && !isCalibrated && !isGhostMode && (
        <div className="calibration-toast">
          🎙️ Say "Hello" to calibrate your voice filter...
        </div>
      )}
      <header className={`ribbon-container ${(isCapturingVision || autoVision) ? 'vision-active' : ''}`}>
        <div className="drag-handle"></div>
        <div className="title-group">
          <h1 className="title">Altus AI</h1>
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
            onClick={handleExport}
            title="Export Session (Markdown)"
          >
            <MessageSquare size={16} />
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
        <div className={`obsidian-drawer ${showSettings ? 'open' : ''}`}>
           <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '16px'}}>
              <h3 style={{color: 'var(--neon-white)', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px'}}>Configuration</h3>
              <button className="control-btn" onClick={() => setShowSettings(false)}><ChevronRight size={18}/></button>
           </div>
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

            <div className="input-group slider-group">
              <label>Stealth Opacity ({Math.round(appOpacity * 100)}%)</label>
              <input 
                type="range" 
                min="0.1" 
                max="1.0" 
                step="0.01" 
                className="premium-slider"
                value={appOpacity}
                onChange={handleOpacityChange}
              />
            </div>

            <button className="save-btn" onClick={handleSaveSettings}>Save & Encrypt</button>
            
            <div className="settings-divider"></div>

            {/* COMMAND CENTER: ADVANCED HARDWARE & AI */}
            <div className="advanced-settings">
              <div className="input-group">
                <label><Mic size={12}/> Audio Hardware</label>
                <select 
                  className="obsidian-select"
                  value={selectedDevice}
                  onChange={(e) => handleDeviceChange(e.target.value)}
                >
                  <option value="default">Default System Audio</option>
                  {audioDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Unknown Microphone'}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label><Layers size={12}/> Intelligence Core</label>
                <div className="model-dash-list">
                  {MODEL_REGISTRY.map(m => (
                    <div 
                      key={m.id} 
                      className={`model-card ${selectedModel === m.id ? 'active' : ''}`}
                      onClick={() => handleModelChange(m.id)}
                    >
                      <div className="model-header">
                        <span className="model-name">{m.name}</span>
                        <span className="model-cost">{m.cost}</span>
                      </div>
                      <div className="model-info">
                        <span>{m.power}</span>
                        <span>{m.usage}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label><Keyboard size={12}/> Global Hotkeys</label>
                <div className="hotkey-item">
                  <span>Vision Capture</span>
                  <button 
                    className={`hotkey-btn ${isRecordingHotkey === 'visionCapture' ? 'recording' : ''}`}
                    onClick={() => recordHotkey('visionCapture')}
                  >
                    {isRecordingHotkey === 'visionCapture' ? '...Press Keys' : hotkeys.visionCapture.replace('CommandOrControl+', 'Ctrl+')}
                  </button>
                </div>
                <div className="hotkey-item">
                  <span>Toggle Visibility</span>
                  <button 
                    className={`hotkey-btn ${isRecordingHotkey === 'toggleVisibility' ? 'recording' : ''}`}
                    onClick={() => recordHotkey('toggleVisibility')}
                  >
                    {isRecordingHotkey === 'toggleVisibility' ? '...Press Keys' : (hotkeys.toggleVisibility || 'Ctrl+Shift+V').replace('CommandOrControl+', 'Ctrl+')}
                  </button>
                </div>
              </div>
            </div>

            <p className="hint">Configuration is secured via AES-256 System Storage.</p>
        </div>

        <div className="transcript-area">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
            <span style={{fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase'}}>Live Stream</span>
            {isCapturing && (
              <div className="voice-visualizer">
                <div className="voice-bar"></div>
                <div className="voice-bar"></div>
                <div className="voice-bar"></div>
              </div>
            )}
          </div>
          {transcript.length === 0 && !isCapturing && <p style={{opacity: 0.4}}>Ready for interview...</p>}
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
                  <span>Altus AI is thinking...</span>
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
      </main>
      )}
    </div>
  );
};

export default App;
