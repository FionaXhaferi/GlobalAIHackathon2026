export type NoveltySignal = 'not_found' | 'similar_exists' | 'exact_match';

export interface Reference {
  title: string;
  authors: string[];
  year: number;
  url: string;
  relevance_reason: string;
}

export interface LiteratureResult {
  novelty_signal: NoveltySignal;
  references: Reference[];
  summary: string;
  sources_searched?: string[];
}

export interface ProtocolStep {
  step: number;
  title: string;
  description: string;
  duration: string;
  notes: string;
}

export interface Material {
  name: string;
  catalog_number: string;
  supplier: string;
  quantity: string;
  unit_cost: number;
  total_cost: number;
  category: string;
  notes: string;
}

export interface BudgetLineItem {
  category: string;
  item: string;
  quantity: string;
  unit_cost: number;
  total_cost: number;
  notes: string;
}

export interface Budget {
  total_usd: number;
  currency: string;
  categories: Record<string, number>;
  line_items: BudgetLineItem[];
}

export interface TimelinePhase {
  phase: number;
  name: string;
  duration: string;
  start_week: number;
  end_week: number;
  tasks: string[];
  dependencies: string[];
  deliverables: string[];
}

export interface Timeline {
  total_duration: string;
  total_weeks: number;
  phases: TimelinePhase[];
}

export interface ValidationApproach {
  primary_endpoints: string[];
  secondary_endpoints: string[];
  success_criteria: string[];
  failure_criteria: string[];
  statistical_approach: string;
  controls: string[];
  replicates: string;
}

export interface ExperimentPlan {
  title: string;
  summary: string;
  experiment_tags: string[];
  protocol: {
    overview: string;
    steps: ProtocolStep[];
  };
  materials: Material[];
  budget: Budget;
  timeline: Timeline;
  validation: ValidationApproach;
  safety_notes: string[];
  protocol_references: string[];
  error?: string;
  raw?: string;
}

export interface SubScore {
  score: number;
  label: string;
  icon: string;
  feedback: string;
}

export interface ReadinessScore {
  overall: number;
  sub_scores: {
    protocol_completeness: SubScore;
    reagent_availability: SubScore;
    budget_realism: SubScore;
    statistical_power: SubScore;
    safety_coverage: SubScore;
    citation_density: SubScore;
  };
  verdict: string;
  top_issues: string[];
}

export interface FeedbackPayload {
  question: string;
  experiment_tags: string[];
  section: string;
  original_content: unknown;
  corrected_content: unknown;
  rating: number;
  annotations: string;
}

export type AppStage =
  | 'input'
  | 'lit-loading'
  | 'lit-done'
  | 'plan-loading'
  | 'plan-done';
