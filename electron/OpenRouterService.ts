import axios from 'axios';
import { EventEmitter } from 'events';
import { MemoryManager } from './MemoryManager';

export type InterviewPersona = 'Technical' | 'SystemDesign' | 'Behavioral';
export type ModelMode = 'Turbo' | 'Genius';

const MODELS = {
  Turbo: 'google/gemini-flash-1.5-8b',
  Genius: 'anthropic/claude-3-5-sonnet',
};

const SYSTEM_PROMPTS: Record<InterviewPersona, string> = {
  Technical: `You are a Senior Principal Engineer with 15+ years of experience. 
    Provide precise, high-density technical answers. 
    - Skip conversational filler and "Sure, I can help with that."
    - Use bullet points for steps or key concepts.
    - Provide optimized, production-grade code snippets using modern best practices (e.g., proper error handling, O(n) complexity).
    - If the context is a vision capture, describe only what is relevant to solving the coding/logic problem shown.`,
    
  SystemDesign: `You are a Principal Software Architect specialize in distributed systems. 
    - Structure answers based on Requirements -> High Level Design -> Component Deep Dive -> Trade-offs.
    - Mention specific technologies (Kafka, Redis, Kubernetes, PostgreSQL vs NoSQL).
    - Discuss CAP theorem, latency vs throughput, and horizontal scaling.
    - Use Mermaid syntax for diagrams if the user asks for design.`,
    
  Behavioral: `You are an expert Leadership Coach and Engineering Manager. 
    - Translate answers into the STAR+ method (Situation, Task, Action, Result + Learning).
    - Focus on mentorship, conflict resolution, and business impact.
    - Keep answers under 120 words to ensure they can be delivered naturally.`,
};

export class OpenRouterService extends EventEmitter {
  private apiKey: string;
  private currentMode: ModelMode = 'Turbo';
  private currentPersona: InterviewPersona = 'Technical';
  private memoryManager: MemoryManager;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.memoryManager = new MemoryManager(apiKey);
  }

  public setMode(mode: ModelMode) {
    this.currentMode = mode;
  }

  public setPersona(persona: InterviewPersona) {
    this.currentPersona = persona;
  }

  public async getAnswer(question: string, base64Image?: string) {
    // If an image is provided, we MUST use a vision-capable model.
    // Claude-3.5-Sonnet is significantly better at diagram/code analysis than Gemma.
    const model = base64Image ? MODELS.Genius : MODELS[this.currentMode];
    const systemPrompt = SYSTEM_PROMPTS[this.currentPersona];

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

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/aura-ai', // Required by OpenRouter
          'X-Title': 'Aura Interview Assistant',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          stream: true,
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
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
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Save to history via Memory Manager (which triggers silent background summarization)
      this.memoryManager.addInteraction({ role: 'user', content: userContent }, fullText);
      
      this.emit('answer-end', fullText);
    } catch (error) {
      console.error('[OpenRouter] Global error:', error);
      this.emit('error', error);
    }
  }

  public clearHistory() {
    this.memoryManager.clear();
  }
}
