CREATE TABLE "AuthThrottleBucket" (
    "key" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL,
    "windowExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "AuthThrottleBucket_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "AuthThrottleBucket_attemptCount_check" CHECK ("attemptCount" >= 0)
);

CREATE INDEX "AuthThrottleBucket_windowExpiresAt_idx" ON "AuthThrottleBucket"("windowExpiresAt");
