import axios from 'axios';

// Fast, cheap model strictly for summarizing context in the background
const COMPRESSION_MODEL = 'google/gemini-flash-1.5-8b';

export class MemoryManager {
  private apiKey: string;
  private shortTermHistory: { role: 'user' | 'assistant' | 'system', content: string | any[] }[] = [];
  private semanticSummary: string = '';
  private isCompressing: boolean = false;
  
  // Keep the last 6 messages (3 Q&A pairs) verbatim
  private readonly VERBATIM_LIMIT = 6;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public setApiKey(key: string) {
    this.apiKey = key;
  }

  public clear() {
    this.shortTermHistory = [];
    this.semanticSummary = '';
    this.isCompressing = false;
  }

  public addInteraction(userMsg: any, assistantContent: string) {
    this.shortTermHistory.push(userMsg);
    this.shortTermHistory.push({ role: 'assistant', content: assistantContent });
    this.triggerCompressionLoop();
  }

  public getContext(systemPrompt: string): any[] {
    const context: any[] = [];
    context.push({ role: 'system', content: systemPrompt });
    
    if (this.semanticSummary) {
      context.push({ 
        role: 'system', 
        content: `PREVIOUS INTERVIEW CONTEXT MEMORY: ${this.semanticSummary}` 
      });
    }

    context.push(...this.shortTermHistory);
    return context;
  }

  private async triggerCompressionLoop() {
    if (this.isCompressing || this.shortTermHistory.length <= this.VERBATIM_LIMIT) return;

    this.isCompressing = true;

    // Guard: need at least 1 full Q&A pair (2 items) before compressing
    if (this.shortTermHistory.length < 2) {
      this.isCompressing = false;
      return;
    }

    // Slice out the oldest Q&A pair (first 2 items in history)
    const agingContext = this.shortTermHistory.splice(0, 2);
    if (agingContext.length < 2) {
      // Incomplete pair — put it back to avoid data loss
      this.shortTermHistory.unshift(...agingContext);
      this.isCompressing = false;
      return;
    }
    
    try {
      const qText = typeof agingContext[0].content === 'string' 
        ? agingContext[0].content 
        // @ts-ignore
        : (agingContext[0].content as any[]).map(c => c.text || '').join(' ');
      
      const aText = agingContext[1].content;

      const prompt = `You are a background Memory System running silently during a live technical interview.
Update the current summary of the interview with the new Q&A interaction.
RULES:
1. Be extremely concise. Compress facts.
2. Maintain any specific technologies, design decisions, code constraints, or personal stories discussed.
3. Drop conversational filler.

CURRENT SUMMARY:
"${this.semanticSummary || "No prior summary. Starting fresh."}"

NEW INTERACTION TO ADD:
User: ${qText}
Assistant: ${aText}`;

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: COMPRESSION_MODEL,
          messages: [{ role: 'system', content: prompt }],
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/Hey-Astreon/Altus-Ai-Platinum',
            'X-Title': 'Altus AI Platinum',
          }
        }
      );

      if (response.data?.choices && response.data.choices[0]?.message?.content) {
        this.semanticSummary = response.data.choices[0].message.content.trim();
        console.log('[MemoryManager] Successfully compressed context. New Summary size:', this.semanticSummary.length);
      }
    } catch (err: any) {
      console.error('[MemoryManager] Compression failure. Will try again on next loop.', err?.message);
      // Put them back at the top so we don't lose them!
      this.shortTermHistory.unshift(...agingContext);
    } finally {
      this.isCompressing = false;
      // Loop recursively in case there was a massive backlog
      if (this.shortTermHistory.length > this.VERBATIM_LIMIT) {
        this.triggerCompressionLoop();
      }
    }
  }
}
