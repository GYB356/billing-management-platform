-- CreateTable
CREATE TABLE "ForecastModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "metadata" JSONB,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTraining" TIMESTAMP(3),
    "metrics" JSONB,

    CONSTRAINT "ForecastModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSeriesData" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "modelId" TEXT NOT NULL,

    CONSTRAINT "TimeSeriesData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastResult" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "lowerBound" DOUBLE PRECISION,
    "upperBound" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "modelId" TEXT NOT NULL,

    CONSTRAINT "ForecastResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketTrend" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "trend" DOUBLE PRECISION NOT NULL,
    "seasonality" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "MarketTrend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionInterval" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "lowerBound" DOUBLE PRECISION NOT NULL,
    "upperBound" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "PredictionInterval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeSeriesData_modelId_timestamp_idx" ON "TimeSeriesData"("modelId", "timestamp");

-- CreateIndex
CREATE INDEX "ForecastResult_modelId_timestamp_idx" ON "ForecastResult"("modelId", "timestamp");

-- CreateIndex
CREATE INDEX "MarketTrend_timestamp_idx" ON "MarketTrend"("timestamp");

-- AddForeignKey
ALTER TABLE "TimeSeriesData" ADD CONSTRAINT "TimeSeriesData_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ForecastModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastResult" ADD CONSTRAINT "ForecastResult_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ForecastModel"("id") ON DELETE CASCADE ON UPDATE CASCADE; 