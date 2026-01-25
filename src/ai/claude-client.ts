import Anthropic from '@anthropic-ai/sdk';
import { getLogger } from '../utils.js';

const logger = getLogger();

export interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AnalysisResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  stopReason: string | null;
}

const DEFAULT_CONFIG: ClaudeConfig = {
  apiKey: process.env.CLAUDE_API_KEY || '',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 1024,
  temperature: 0.3
};

/**
 * Claude API Client for AI-powered market analysis
 */
export class ClaudeClient {
  private client: Anthropic | null = null;
  private config: ClaudeConfig;
  private isInitialized: boolean = false;
  private requestCount: number = 0;
  private lastRequestTime: Date | null = null;

  constructor(config?: Partial<ClaudeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the Claude client
   */
  initialize(apiKey?: string): void {
    const key = apiKey || this.config.apiKey;

    if (!key) {
      logger.warn('Claude API key not provided - AI features will be disabled');
      return;
    }

    try {
      this.client = new Anthropic({ apiKey: key });
      this.isInitialized = true;
      logger.info('Claude client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Claude client:', error);
      throw error;
    }
  }

  /**
   * Check if the client is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Send a prompt to Claude and get a response
   */
  async analyze(prompt: string, systemPrompt?: string): Promise<AnalysisResponse> {
    if (!this.client) {
      throw new Error('Claude client not initialized. Call initialize() first.');
    }

    try {
      this.requestCount++;
      this.lastRequestTime = new Date();

      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: prompt }
      ];

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages
      });

      // Extract text content
      const textContent = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as Anthropic.TextBlock).text)
        .join('\n');

      return {
        content: textContent,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        },
        model: response.model,
        stopReason: response.stop_reason
      };

    } catch (error: any) {
      logger.error('Claude API error:', error);

      // Handle rate limiting
      if (error.status === 429) {
        logger.warn('Rate limited by Claude API - backing off');
        await this.delay(5000);
        throw new Error('Rate limited - please try again');
      }

      throw error;
    }
  }

  /**
   * Analyze with structured JSON output
   */
  async analyzeJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const jsonSystemPrompt = `${systemPrompt || ''}

IMPORTANT: Your response must be valid JSON only. Do not include any text before or after the JSON.`;

    const response = await this.analyze(prompt, jsonSystemPrompt);

    try {
      // Try to extract JSON from the response
      let jsonStr = response.content.trim();

      // Handle markdown code blocks
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }

      return JSON.parse(jsonStr.trim()) as T;

    } catch (parseError) {
      logger.error('Failed to parse Claude response as JSON:', response.content);
      throw new Error('Invalid JSON response from Claude');
    }
  }

  /**
   * Get usage statistics
   */
  getStats(): {
    requestCount: number;
    lastRequestTime: Date | null;
    model: string;
  } {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      model: this.config.model
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClaudeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * Set model
   */
  setModel(model: string): void {
    this.config.model = model;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const claudeClient = new ClaudeClient();
