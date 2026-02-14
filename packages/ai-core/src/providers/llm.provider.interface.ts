/**
 * LLM Provider Interface
 *
 * All LLM providers must implement this interface to ensure
 * consistent behavior across different AI services.
 */

import type { LlmRequest, LlmResponse } from '../types/index.js';

export interface LlmProvider {
  /**
   * Generate a response from the LLM
   */
  generate(request: LlmRequest): Promise<LlmResponse>;

  /**
   * Generate a streaming response from the LLM.
   * Falls back to non-streaming providers via adapter methods in higher layers.
   */
  generateStream?(request: LlmRequest): AsyncGenerator<string>;

  /**
   * Check if the provider is available/healthy
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the provider name
   */
  getName(): string;
}
