export interface MLModel {
  id: string;
  name: string;
  version: string;
  type: MLModelType;
  parameters: Record<string, any>;
  metadata: MLModelMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export enum MLModelType {
  CLASSIFICATION = 'CLASSIFICATION',
  REGRESSION = 'REGRESSION',
  CLUSTERING = 'CLUSTERING',
  ANOMALY_DETECTION = 'ANOMALY_DETECTION'
}

export interface MLModelMetadata {
  framework: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  trainedOn: Date;
  datasetVersion: string;
  inputFeatures: string[];
  outputFeatures: string[];
} 