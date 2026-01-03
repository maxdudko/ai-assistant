/**
 * LLM Provider Interface
 *
 * All LLM providers must implement this interface to ensure
 * consistent behavior across different AI services.
 */

import { LlmRequest, LlmResponse } from '../types/index.js';

export interface LlmProvider {
  /**
   * Generate a response from the LLM
   */
  generate(request: LlmRequest): Promise<LlmResponse>;

  /**
   * Check if the provider is available/healthy
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the provider name
   */
  getName(): string;
}
