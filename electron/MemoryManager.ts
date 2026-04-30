import axios from 'axios';

// Fast, free model strictly for summarizing context in the background
// NOTE: gemini-flash-1.5-8b was returning 404 (deprecated). Using llama free tier instead.
const COMPRESSION_MODEL = 'openrouter/auto';

export class MemoryManager {
  private apiKey: string;
  private shortTermHistory: { role: 'user' | 'assistant' | 'system', content: string | any[] }[] = [];
  private semanticSummary: string = '';
  private isCompressing: boolean = false;
  private compressionFailures: number = 0;        // NEW: track consecutive failures
  private readonly MAX_FAILURES = 3;              // NEW: disable compression after 3 failures
  
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
    // SPEED MODE: History disabled for real-time voice interviews.
    // Each question is independent — no context bloat, maximum speed.
  }

  public getContext(systemPrompt: string): any[] {
    // SPEED MODE: Only system prompt, no history.
    // Keeps every API call minimal and guarantees 2-3 second responses.
    return [{ role: 'system', content: systemPrompt }];
  }

  private async triggerCompressionLoop() {
    // Safety gates: don't compress if already compressing, not enough history, or too many failures
    if (this.isCompressing) return;
    if (this.shortTermHistory.length <= this.VERBATIM_LIMIT) return;
    if (this.compressionFailures >= this.MAX_FAILURES) {
      // Silently skip — compression is broken for this session (bad API key or quota)
      return;
    }

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
          max_tokens: 1000,
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
        this.compressionFailures = 0; // reset on success
        console.log('[MemoryManager] Context compressed. Summary size:', this.semanticSummary.length);
      }
    } catch (err: any) {
      this.compressionFailures++;
      console.error(`[MemoryManager] Compression failure (${this.compressionFailures}/${this.MAX_FAILURES}).`, err?.message);
      // Put them back so we don't lose the conversation
      this.shortTermHistory.unshift(...agingContext);
      if (this.compressionFailures >= this.MAX_FAILURES) {
        console.warn('[MemoryManager] Max failures reached. Compression disabled for this session.');
      }
    } finally {
      this.isCompressing = false;
      // Only recurse if there's a backlog AND compression is still healthy
      if (this.shortTermHistory.length > this.VERBATIM_LIMIT && this.compressionFailures < this.MAX_FAILURES) {
        this.triggerCompressionLoop();
      }
    }
  }
}
