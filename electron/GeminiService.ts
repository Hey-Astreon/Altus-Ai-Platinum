import { EventEmitter } from 'events';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MASTER_PROMPT = `EXAM SPECIALIST MODE: Provide perfectly accurate answers.
- SECTION-A & B: Professional, structured long-form responses.
- SECTION-C: State the CORRECT OPTION letter first in BOLD.
- Accuracy is priority. No preamble. No conversational filler.`;

export class GeminiService extends EventEmitter {
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  public isStreaming: boolean = false;

  constructor(apiKeys: string[]) {
    super();
    this.apiKeys = apiKeys;
  }

  public abort() {
    this.isStreaming = false;
  }

  public async getAnswer(question: string, base64Image?: string, retryCount: number = 0): Promise<void> {
    if (this.apiKeys.length === 0) {
      this.emit('error', 'No Google API keys provided.');
      return;
    }

    const currentKey = this.apiKeys[this.currentKeyIndex];
    this.isStreaming = true;

    try {
      const genAI = new GoogleGenerativeAI(currentKey);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

      const promptParts: any[] = [MASTER_PROMPT, question || "Solve the question shown."];
      
      if (base64Image) {
        promptParts.push({
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg"
          }
        });
      }

      // NETWORK RESILIENCE: Set a hard timeout for the initial connection
      const result = await Promise.race([
        model.generateContentStream(promptParts),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Intelligence Link Timeout')), 15000))
      ]) as any;
      
      let fullText = '';
      for await (const chunk of result.stream) {
        if (!this.isStreaming) break;
        try {
          const chunkText = chunk.text();
          fullText += chunkText;
          this.emit('answer-chunk', chunkText);
        } catch (e) {
          // Handle partial stream errors silently
        }
      }

      if (fullText) {
        this.emit('answer-end', fullText);
      } else if (this.isStreaming) {
        throw new Error('Empty Intelligence Stream');
      }

    } catch (error: any) {
      console.error('[GeminiService] Fault:', error);
      
      // AUTO-FAILOVER: If one key or model fails, switch to the next key instantly
      if (retryCount < this.apiKeys.length - 1) {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        return this.getAnswer(question, base64Image, retryCount + 1);
      }
      
      this.emit('error', `Intelligence Link Error: ${error.message || 'Unknown'}`);
    } finally {
      this.isStreaming = false;
    }
  }

  public clearMemory() {}
}
