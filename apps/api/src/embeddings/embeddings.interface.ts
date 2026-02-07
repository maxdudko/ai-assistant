export interface EmbeddingsService {
  embed(text: string): Promise<number[]>;
}
