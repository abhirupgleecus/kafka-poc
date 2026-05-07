export type WorkflowStage =
  | "RAW"
  | "ENRICHED"
  | "ASSESSMENT"
  | "TRIAGE"
  | "GAINS"
  | "SUMMARY"
  | "EMAIL";
export type ReplayStageStatus = "COMPLETED" | "PENDING";

export interface WorkflowEvent {
  stage: string;
  timestamp: string;
  payload: Record<string, unknown>;
  run_id: string | null;
}

export interface WorkflowResponse {
  upc: string;
  events: WorkflowEvent[];
}

export interface ReplayRequest {
  upc: string;
  run_id: string;
}

export interface ReplayStageDetail {
  stage: WorkflowStage;
  status: ReplayStageStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  notes: string;
  timestamp: string | null;
}

export interface ReplayResponse {
  status: string;
  upc: string;
  run_id: string;
  stages: ReplayStageDetail[];
}

export interface RerunRequest {
  upc: string;
  run_id: string;
}

export interface RerunResponse {
  status: string;
  upc: string;
  source_run_id: string;
  run_id: string;
  assessment_status: "pending" | "copied";
  assessment: string | null;
}

export interface ProductAssessment {
  physical_condition: string;
  functional_status: string;
  completeness: string;
  age_of_product: string;
}

export interface ProduceRequest {
  upc: string;
}

export interface AssessmentRequest {
  upc: string;
  run_id: string;
  assessment: ProductAssessment;
}
