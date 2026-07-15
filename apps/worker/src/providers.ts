export interface GeneratedLessonDraft {
  title: string
  summary: string
  deepExplanation: string
  sourceUrls: string[]
}

export interface ContentGenerationProvider {
  generateLesson(topic: string, learningContext: string): Promise<GeneratedLessonDraft>
}

export interface SourceVerificationResult {
  supported: boolean
  verifiedOn: string
  supportedClaims: string[]
}

export interface SourceVerificationProvider {
  verify(url: string, claims: string[]): Promise<SourceVerificationResult>
}

export interface FreeTextEvaluation {
  keyConceptsPresent: string[]
  keyConceptsMissing: string[]
  feedback: string
}

export interface EvaluationProvider {
  evaluate(answer: string, referenceAnswer: string, keyConcepts: string[]): Promise<FreeTextEvaluation>
}
