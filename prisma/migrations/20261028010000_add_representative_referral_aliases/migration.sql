CREATE TABLE "RepresentativeReferralAlias" (
    "slug" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RepresentativeReferralAlias_pkey" PRIMARY KEY ("slug"),
    CONSTRAINT "RepresentativeReferralAlias_slug_format" CHECK (
      "slug" ~ '^[a-z][a-z0-9-]{1,47}$' AND right("slug", 1) <> '-' AND "slug" <> 'portal'
    )
);

CREATE INDEX "RepresentativeReferralAlias_representativeId_idx" ON "RepresentativeReferralAlias"("representativeId");

ALTER TABLE "RepresentativeReferralAlias" ADD CONSTRAINT "RepresentativeReferralAlias_representativeId_fkey"
FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
