import axios from 'axios';
import { EventEmitter } from 'events';
import { InterviewPersona, ModelMode } from './OpenRouterService';
import { MemoryManager } from './MemoryManager';

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';

const LOCAL_MODELS = {
  Turbo: 'llama3:8b', // Fast, robust reasoning
  Genius: 'llama3:70b', // Deep reasoning
  Vision: 'llava', // Required for image analysis
};

const SYSTEM_PROMPTS: Record<InterviewPersona, string> = {
  Technical: `You are a Senior Principal Engineer with 15+ years of experience. 
    Provide precise, high-density technical answers. 
    - Skip conversational filler and "Sure, I can help with that."
    - Use bullet points for steps or key concepts.
    - Provide optimized, production-grade code snippets using modern best practices.
    - If the context is a vision capture, describe only what is relevant to solving the coding/logic problem shown.`,
    
  SystemDesign: `You are a Principal Software Architect specialize in distributed systems. 
    - Structure answers based on Requirements -> High Level Design -> Component Deep Dive -> Trade-offs.
    - Mention specific technologies (Kafka, Redis, Kubernetes, PostgreSQL vs NoSQL).
    - Discuss CAP theorem, latency vs throughput, and horizontal scaling.`,
    
  Behavioral: `You are an expert Leadership Coach and Engineering Manager. 
    - Translate answers into the STAR method (Situation, Task, Action, Result) quickly.
    - Focus on mentorship, conflict resolution, and impact.
    - Keep answers under 120 words.`,
};

export class OllamaService extends EventEmitter {
  private currentMode: ModelMode = 'Turbo';
  private currentPersona: InterviewPersona = 'Technical';
  private memoryManager: MemoryManager;
  private abortController: AbortController | null = null;

  constructor(openRouterKey: string) {
    super();
    this.memoryManager = new MemoryManager(openRouterKey);

    // Verify Ollama connection silently
    axios.get('http://127.0.0.1:11434/api/tags').catch(() => {
      console.warn('[Aura Local] Ollama is not running on localhost:11434. Local AI will fail.');
    });
  }

  public setMode(mode: ModelMode) {
    this.currentMode = mode;
  }

  public setPersona(persona: InterviewPersona) {
    this.currentPersona = persona;
    this.memoryManager.clear(); // Reset history when changing personas
  }

  public abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async getAnswer(question: string, base64Image?: string) {
    const model = base64Image ? LOCAL_MODELS.Vision : LOCAL_MODELS[this.currentMode];
    const systemPrompt = SYSTEM_PROMPTS[this.currentPersona];

    let userMessage: any = {
      role: 'user',
      content: question || "Explain what is in this image briefly and how to solve the problem.",
    };

    if (base64Image) {
      // Ollama expects base64 without the 'data:image/png;base64,' prefix
      const strippedBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, "");
      userMessage.images = [strippedBase64];
    }

    const messages = this.memoryManager.getContext(systemPrompt);
    messages.push(userMessage);

    this.abort(); // Cancel any existing local request
    this.abortController = new AbortController();

    try {
      const response = await axios.post(
        OLLAMA_URL,
        {
          model: model,
          messages: messages,
          stream: true,
          options: {
            temperature: 0.3, // Keep it precise
            num_ctx: 4096, // Ensure context window is large enough for transcripts
          }
        },
        { 
          responseType: 'stream',
          signal: this.abortController.signal
        }
      );

      let fullResponse = '';
      
      let inactivityTimer = setTimeout(() => {
        this.abort();
        this.emit('answer-end', fullResponse + "\n\n**[LOCAL STABILITY ALERT]** Ollama stalled.");
      }, 15000);

      response.data.on('data', (chunk: Buffer) => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          this.abort();
          this.emit('answer-end', fullResponse + "\n\n**[LOCAL STABILITY ALERT]** Ollama connection lost mid-stream.");
        }, 15000);

        const lines = chunk.toString('utf8').split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.message?.content) {
              const text = data.message.content;
              fullResponse += text;
              this.emit('answer-chunk', text);
            }
          } catch (e) {
            // Ignore malformed JSON chunks from raw socket stream edges
          }
        }
      });

      response.data.on('end', () => {
        clearTimeout(inactivityTimer);
        this.memoryManager.addInteraction(userMessage, fullResponse);
        this.emit('answer-end', fullResponse);
      });

    } catch (error: any) {
      console.error('[Aura Local] Ollama API Error:', error.message);
      let errorMsg = '\\n\\n**[AURA SYSTEM ERROR]** Ollama connection failed. ';
      if (error.code === 'ECONNREFUSED') {
         errorMsg += 'Please ensure Ollama is running (`ollama serve`) and the models (`llama3:8b`, `llava`) are installed.';
      }
      this.emit('answer-end', errorMsg);
    }
  }
}
