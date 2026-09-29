-- CreateTable
CREATE TABLE "Danmaku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "time" REAL NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'scroll',
    "color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "size" INTEGER NOT NULL DEFAULT 24,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    CONSTRAINT "Danmaku_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Danmaku_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Danmaku_videoId_time_idx" ON "Danmaku"("videoId", "time");
