CREATE TYPE "TestSessionStatus" AS ENUM ('IN_PROGRESS', 'BOTH_COMPLETED', 'REPORT_READY');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "telegramId" TEXT NOT NULL,
  "telegramName" TEXT,
  "firstName" TEXT,
  "displayName" TEXT,
  "age" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pair" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "inviteCode" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pair_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PairMember" (
  "id" TEXT NOT NULL,
  "pairId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PairMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TestSession" (
  "id" TEXT NOT NULL,
  "pairId" TEXT NOT NULL,
  "testSlug" TEXT NOT NULL,
  "status" "TestSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "freeReport" JSONB,
  "fullReport" JSONB,
  "fullUnlocked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TestSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Answer" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "question" INTEGER NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amountRub" INTEGER NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
CREATE UNIQUE INDEX "Pair_inviteCode_key" ON "Pair"("inviteCode");
CREATE UNIQUE INDEX "PairMember_userId_key" ON "PairMember"("userId");
CREATE UNIQUE INDEX "PairMember_pairId_userId_key" ON "PairMember"("pairId", "userId");
CREATE INDEX "TestSession_pairId_testSlug_idx" ON "TestSession"("pairId", "testSlug");
CREATE UNIQUE INDEX "Answer_sessionId_userId_question_key" ON "Answer"("sessionId", "userId", "question");

ALTER TABLE "PairMember" ADD CONSTRAINT "PairMember_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PairMember" ADD CONSTRAINT "PairMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestSession" ADD CONSTRAINT "TestSession_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
