import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class AssemblyAIService extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private sampleRate: number;

  constructor(apiKey: string, sampleRate: number = 16000) {
    super();
    this.apiKey = apiKey;
    this.sampleRate = sampleRate;
  }

  public connect() {
    if (this.ws) return;

    const url = `wss://streaming.assemblyai.com/v3/ws?sample_rate=${this.sampleRate}&speech_model=u3-rt-pro&encoding=pcm_s16le&speaker_labels=true`;
    
    const ws = new WebSocket(url, {
      headers: {
        Authorization: this.apiKey,
      },
    });

    this.ws = ws;

    ws.on('open', () => {
      console.log('[AssemblyAI] WebSocket connected');
      this.emit('connect');
    });

    ws.on('message', (data: any) => {
      try {
        const response = JSON.parse(data.toString());
        
        if (response.type === 'Begin') {
          console.log('[AssemblyAI] Session started:', response.id);
        } else if (response.type === 'Turn') {
          this.emit('transcript', {
            text: response.transcript,
            isFinal: response.end_of_turn,
            confidence: 1.0,
            speaker: response.speaker_label || 'A',
          });
        } else if (response.error) {
          console.error('[AssemblyAI] Error:', response.error);
          this.emit('error', response.error);
        }
      } catch (e) {
        console.error('[AssemblyAI] Parse error:', e);
      }
    });

    ws.on('close', (code: number, reason: any) => {
      console.log('[AssemblyAI] WebSocket closed:', code, reason.toString());
      this.ws = null;
      this.emit('disconnect');
    });

    ws.on('error', (err: any) => {
      console.error('[AssemblyAI] WebSocket error:', err);
      this.emit('error', err);
    });
  }

  public sendAudio(chunk: Buffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.send(JSON.stringify({ terminate_session: true }));
      this.ws.close();
      this.ws = null;
    }
  }
}
