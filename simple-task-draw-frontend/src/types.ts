export type Objective = {
  id: string;
  path: string;
  prompt: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Submission = {
  id: string;
  objective_id: string;
  created_at: string;
  duration_ms: number;
  rating_clarity: number;
  rating_accuracy: number;
  rating_confidence: number;
  rating_speed: number;
  notes?: string | null;
};

export type ProgressSummary = {
  objective_id: string;
  total_submissions: number;
  total_duration_ms: number;
  avg_rating: number;
  last_submitted_at: string | null;
  current_streak_days: number;
  best_streak_days: number;
  heatmap: { date: string; count: number }[];
};

export type TelemetryOverview = {
  total_submissions: number;
  total_objectives: number;
  avg_rating: number;
  total_duration_ms: number;
  recent_submissions: {
    id: string;
    created_at: string;
    duration_ms: number;
    avg_rating: number;
    objective_path: string;
  }[];
  random_objective: Objective | null;
  heatmap: { date: string; count: number }[];
};
