export class QuestionDetector {
  private lastTriggeredText: string = '';

  /**
   * Simple heuristic to detect if a transcript contains a question.
   * We look for question marks or starting keywords.
   */
  private lastTriggeredTime: number = 0;
  private readonly TRIGGER_COOLDOWN = 1500; // 1.5 seconds cooldown (was 3s — too slow for Discord)

  /**
   * Simple heuristic to detect if a transcript contains a question.
   */
  public isQuestion(text: string): boolean {
    const trimmed = text.trim().toLowerCase();
    const now = Date.now();
    
    // Basic safety gates
    if (trimmed.length < 5) return false;
    if (now - this.lastTriggeredTime < this.TRIGGER_COOLDOWN) return false;
    if (trimmed === this.lastTriggeredText) return false;

    const questionKeywords = [
      'who', 'what', 'where', 'when', 'why', 'how', 
      'can', 'could', 'would', 'describe', 'explain', 
      'tell', 'show', 'give', 'write', 'implement',
      'is', 'are', 'do', 'does', 'will', 'should', 'define'
    ];

    const hasQuestionMark = trimmed.includes('?');
    const containsKeyword = questionKeywords.some(keyword => {
      // Check if the keyword exists as a standalone word
      const regex = new RegExp(`\\b${keyword}\\b`);
      return regex.test(trimmed);
    });
    
    const isLikelyQuestion = hasQuestionMark || containsKeyword;

    if (isLikelyQuestion) {
      this.lastTriggeredText = trimmed;
      this.lastTriggeredTime = now;
      return true;
    }

    return false;
  }

  public reset() {
    this.lastTriggeredText = '';
  }
}
