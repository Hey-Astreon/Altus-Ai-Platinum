import axios from 'axios';
import { EventEmitter } from 'events';
import { MemoryManager } from './MemoryManager';

export type InterviewPersona = 'Technical' | 'SystemDesign' | 'Behavioral';
export type ModelMode = 'Turbo' | 'Genius';

const MODELS = {
  Turbo: 'meta-llama/llama-3.1-8b-instruct:free',
  Genius: 'anthropic/claude-3.5-sonnet',
};

const MASTER_PROMPT = `EXAM SPECIALIST MODE: Your goal is to provide perfectly accurate answers for proctored exams.
- Output EXACTLY 6 sentences in a single paragraph. 
- Prioritize technical accuracy and conciseness.
- For MCQs, state the correct option first, then explain why.
- NO filler, NO preamble. 100% logic.`;

export class OpenRouterService extends EventEmitter {
  private apiKey: string;
  private memoryManager: MemoryManager;
  private abortController: AbortController | null = null;
  public isStreaming: boolean = false;
  private streamBuffer: string = '';

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.memoryManager = new MemoryManager(apiKey);
  }

  public setApiKey(newKey: string) {
    this.apiKey = newKey;
  }

  private selectBestModel(question: string, hasImage: boolean): string {
    // V3 AUTONOMOUS LOGIC:
    // 1. Always use Genius (Claude 3.5) for Vision tasks (it's the best at OCR).
    // 2. Use Genius for complex coding requests (keywords: 'code', 'function', 'class', 'write', 'implement').
    // 3. Fallback to Turbo (Llama 3.1) for simple text questions/MCQs for sub-second speed.
    
    if (hasImage) return MODELS.Genius;
    
    const complexityKeywords = ['code', 'function', 'class', 'implement', 'algorithm', 'complexity', 'design', 'architecture'];
    const isComplex = complexityKeywords.some(kw => question.toLowerCase().includes(kw));
    
    return isComplex ? MODELS.Genius : MODELS.Turbo;
  }

  public abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async getAnswer(question: string, base64Image?: string) {
    const model = this.selectBestModel(question, !!base64Image);
    const systemPrompt = MASTER_PROMPT;

    let userContent: any = question;
    if (base64Image) {
      userContent = [
        { type: 'text', text: question || "Identify the code or diagram in this screenshot and provide a clear, technical explanation or solution." },
        { 
          type: 'image_url', 
          image_url: { 
            url: `data:image/jpeg;base64,${base64Image}` 
          } 
        }
      ];
    }

    // Build message context via Memory Manager
    const messages = this.memoryManager.getContext(systemPrompt);
    messages.push({ role: 'user', content: userContent });

    this.activeQuestion = question;
    this.isStreaming = true;
    this.streamBuffer = ''; // Reset buffer for new stream

    this.abort(); // Cancel any existing request
    this.abortController = new AbortController();

    try {
      console.log(`[OpenRouter] Sending request for model: ${model}`);
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/Hey-Astreon/Altus-Ai-Platinum',
          'X-Title': 'Altus AI Platinum',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: 150,
          stream: true,
        }),
        signal: this.abortController.signal as any
      });

      console.log(`[OpenRouter] Received response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errText = await response.text();
        console.error(`[OpenRouter] API Error: ${errText}`);
        throw new Error(`OpenRouter error ${response.status}: ${errText}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      console.log('[OpenRouter] Stream reader acquired. Awaiting data...');
      
      // Safety timeout: if we don't get a chunk for 45 seconds, assume dead socket
      let inactivityTimer = setTimeout(() => {
        this.abort();
        this.emit('answer-end', fullText + "\n\n**[STABILITY ALERT]** Connection lost. Response truncated.");
      }, 45000);

      while (true) {
        const { done, value } = await reader.read();
        console.log(`[OpenRouter] Stream chunk read. Done: ${done}, Value Size: ${value ? value.length : 0}`);
        
        // Reset timer on every chunk received
        clearTimeout(inactivityTimer);
        if (!done) {
          inactivityTimer = setTimeout(() => {
            this.abort();
            this.emit('answer-end', fullText + "\n\n**[STABILITY ALERT]** Connection lost mid-stream.");
          }, 45000);
        }

        if (done) {
          clearTimeout(inactivityTimer);
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        this.streamBuffer += chunk;
        const lines = this.streamBuffer.split('\n');
        this.streamBuffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              const text = data.choices[0]?.delta?.content || '';
              if (text) {
                fullText += text;
                this.emit('answer-chunk', text);
              }
            } catch (e) {
              // Should be rare now since chunks are buffered by newline
            }
          }
        }
      }

      // Save to history via Memory Manager (which triggers silent background summarization)
      this.memoryManager.addInteraction({ role: 'user', content: userContent }, fullText);
      
      this.emit('answer-end', fullText);
    } catch (error: any) {
      console.error('[OpenRouter] Global error:', error);
      const msg = error.response?.data?.error?.message || error.message || 'AI Intelligence Link severed.';
      this.emit('error', msg);
    } finally {
      this.isStreaming = false;
    }
  }

  public async analyzeVision(question: string, base64Image?: string): Promise<string> {
    // HARDENING: Each vision request is now independent to prevent race conditions
    return new Promise((resolve) => {
      const systemPrompt = MASTER_PROMPT;
      const model = MODELS.Genius; // Vision tasks always use the top-tier model
      
      let userContent: any = question || "Solve this question.";
      if (base64Image) {
        userContent = [
          { type: 'text', text: userContent },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ];
      }

      const messages = this.memoryManager.getContext(systemPrompt);
      messages.push({ role: 'user', content: userContent });

      fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/aura-ai',
          'X-Title': 'Altus AI Platinum',
        },
        body: JSON.stringify({ model, messages, max_tokens: 150, stream: false }), // Simple non-stream request for high accuracy
      })
      .then(res => res.json())
      .then(data => {
        const answer = data.choices[0]?.message?.content || 'Metadata analysis failed.';
        resolve(answer);
      })
      .catch(() => resolve('Intelligence link severed.'));
    });
  }

  public clearHistory() {
    this.memoryManager.clear();
  }
}
