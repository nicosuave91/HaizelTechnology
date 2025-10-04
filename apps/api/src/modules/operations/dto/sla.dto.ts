export interface SlaHeatmapCell {
  bucket: string;
  total: number;
  warning: number;
  overdue: number;
  query: string;
}

export interface SlaHeatmapResponse {
  scope: 'tasks' | 'orders';
  range: 'week' | 'month';
  cells: SlaHeatmapCell[];
  atRisk: string[];
}
