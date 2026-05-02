import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Eye, 
  Trash2, 
  Settings, 
  Shield, 
  Activity, 
  MessageSquare,
  ChevronRight,
  X,
  Zap,
  Sliders
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Bridge to Electron Main Process
const getApi = () => (window as any).api;

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCamouflaged, setIsCamouflaged] = useState(false);
  const [autoVision, setAutoVision] = useState(false);
  const [appOpacity, setAppOpacity] = useState(1.0);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  
  const [tempKeys, setTempKeys] = useState({ openrouter: '' });
  const answerEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanups: (() => void)[] = [];
    
    // TACTICAL DELAY: Wait for Electron Bridge
    const checkApi = setInterval(() => {
      const api = getApi();
      if (api) {
        clearInterval(checkApi);
        
        api.getSettings().then((data: any) => {
          setTempKeys({ openrouter: data.openrouter || '' });
          setAppOpacity(data.globalOpacity || 0.85);
          document.documentElement.style.setProperty('--app-opacity', (data.globalOpacity || 0.85).toString());
          setIsReady(true);
        });

        const subs = [
          api.onUpdateAvailable(() => setUpdateAvailable(true)),
          api.onUpdateReady(() => setUpdateReady(true)),
          api.onAiThinking(() => setIsThinking(true)),
          api.onAiAnswerChunk((chunk: string) => {
            setIsThinking(false);
            setCurrentAnswer(prev => prev + chunk);
          }),
          api.onAiAnswerEnd((full: string) => {
            setAnswers(prev => [...prev, full]);
            setCurrentAnswer('');
            setIsThinking(false);
          }),
          api.onAiError((err: string) => {
            setAnswers(prev => [...prev, `**[SYSTEM ERROR]** ${err}`]);
            setIsThinking(false);
          }),
          api.onCaptureScreen(() => {
            setIsThinking(true);
            api.send('capture-screen');
          })
        ];
        cleanups = subs;
      }
    }, 50);

    return () => {
      clearInterval(checkApi);
      cleanups.forEach(fn => fn());
    };
  }, []);

  useEffect(() => {
    answerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [answers, currentAnswer, isThinking]);

  const handleCapture = () => {
    const api = getApi();
    if (isThinking) {
      // CANCEL LOGIC
      api.send('abort-solve');
      setIsThinking(false);
      return;
    }
    setIsThinking(true);
    api.send('capture-screen');
  };

  const handleToggleAutoVision = () => {
    const newState = !autoVision;
    setAutoVision(newState);
    if (!newState) getApi().send('abort-solve'); // Stop any active solve when turning off zap
    getApi().send('toggle-auto-vision', newState);
  };

  const handleSaveSettings = () => {
    getApi().send('save-keys', tempKeys);
    setShowSettings(false);
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setAppOpacity(val);
    document.documentElement.style.setProperty('--app-opacity', val.toString());
    getApi().send('set-opacity', val);
  };

  const clearAll = () => {
    setAnswers([]);
    setCurrentAnswer('');
    setIsThinking(false);
    getApi().send('clear-stream');
  };

  const handleClose = () => getApi().send('window-close');

  if (!isReady) return null; // PREVENT RENDER UNTIL BRIDGE ACTIVE

  return (
    <div className="app-wrapper">
      <header className="ribbon-container">
        {/* LEFT POD */}
        <div className="control-pod">
          <button className={`control-btn ${isThinking ? 'thinking-pulse' : ''}`} onClick={handleCapture} title="Manual Solve">
            <Eye size={17} />
          </button>
          <button className={`control-btn ${autoVision ? 'active' : ''}`} onClick={handleToggleAutoVision} title="Auto-Pilot Vision">
            <Zap size={17} />
          </button>
        </div>

        {/* CENTER BRANDING */}
        <div className="branding-pod">
          <div className={`system-heartbeat ${autoVision ? 'auto-pilot' : ''} ${updateAvailable ? 'update-available' : ''}`}></div>
          <h1 className="title">ALTUS AI</h1>
        </div>
        
        {/* RIGHT POD */}
        <div className="control-pod">
          <button className={`control-btn ${isCamouflaged ? 'active' : ''}`} onClick={() => setIsCamouflaged(!isCamouflaged)} title="Stealth Camo">
            <Shield size={17} />
          </button>
          <button className="control-btn" onClick={clearAll} title="Clear Stream">
            <Trash2 size={17} />
          </button>
          <button className="control-btn" onClick={() => setShowSettings(!showSettings)} title="System Configuration">
            <Settings size={17} />
          </button>
          <button className="control-btn close" onClick={handleClose} title="Terminate Session">
            <X size={17} />
          </button>
        </div>
      </header>

      <main className="insight-window">
        {/* SETTINGS DRAWER */}
        <div className={`obsidian-drawer ${showSettings ? 'open' : ''}`}>
           <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
              <h2 style={{fontSize: '0.75rem', letterSpacing: '4px', textTransform: 'uppercase', color: 'var(--ghost-accent)', fontWeight: 900}}>Security Vault</h2>
              <button className="control-btn mini" onClick={() => setShowSettings(false)}><ChevronRight size={18}/></button>
           </div>
           
           <div className="input-group">
             <label style={{display:'flex', justifyContent:'space-between'}}>
                Google Gemini Keys
                {tempKeys.openrouter && <span style={{color: 'var(--ghost-accent)', fontSize: '0.5rem'}}>● Active Direct Link</span>}
             </label>
             <input type="password" placeholder="AI Studio Key 1, Key 2..." value={tempKeys.openrouter} onChange={(e) => setTempKeys({...tempKeys, openrouter: e.target.value})}/>
           </div>

           <div className="input-group slider-group">
             <label>Ghost Opacity ({Math.round(appOpacity * 100)}%)</label>
             <input type="range" min="0.4" max="1.0" step="0.01" value={appOpacity} onChange={handleOpacityChange}/>
           </div>

           {updateReady && (
             <button 
               className="save-btn" 
               style={{background: 'rgba(255, 204, 0, 0.1)', borderColor: '#ffcc00', color: '#ffcc00', marginBottom: '8px'}}
               onClick={() => getApi().send('install-update')}
             >
               Evolve Software
             </button>
           )}

           <button className="save-btn" onClick={handleSaveSettings}>Save & Encrypt</button>
        </div>

        {/* INTELLIGENCE STREAM */}
        <div className="answers-container">
          {answers.map((ans, i) => (
            <div key={i} className="answer-card">
              <ReactMarkdown>{ans}</ReactMarkdown>
            </div>
          ))}
          
          {isThinking && (
            <div className="answer-card live thinking">
              <div className="system-heartbeat mini"></div>
              <span>Analyzing Intelligence...</span>
            </div>
          )}

          {currentAnswer && (
            <div className="answer-card live">
              <ReactMarkdown>{currentAnswer}</ReactMarkdown>
            </div>
          )}
          <div ref={answerEndRef} />
        </div>
      </main>
    </div>
  );
};

export default App;
