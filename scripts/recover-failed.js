const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const fs = require('fs');
const prisma = new PrismaClient();

async function recover() {
  const connection = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
  });
  const videoQueue = new Queue('video-processing', { connection });

  console.log("🔍 Searching for failed or stuck transcode jobs...");
  const failedVideos = await prisma.video.findMany({
    where: { 
      OR: [
        { status: 'ERROR' },
        { status: 'PROCESSING' }
      ]
    }
  });

  if (failedVideos.length === 0) {
    console.log("✅ No failed or stuck videos found.");
    await prisma.$disconnect();
    await connection.quit();
    return;
  }

  for (const video of failedVideos) {
    if (video.originalPath && fs.existsSync(video.originalPath)) {
      console.log(`🚀 Recovering: ${video.title} (ID: ${video.id})`);
      
      // Update status back to PROCESSING
      await prisma.video.update({
        where: { id: video.id },
        data: { status: 'PROCESSING' }
      });

      // Re-add to queue
      await videoQueue.add('process-video', {
        videoId: video.id,
        filePath: video.originalPath,
        originalName: video.title,
      });
      
      console.log("   Added to queue.");
    } else {
      console.log(`⚠️  Cannot recover ${video.title}: Original file missing at ${video.originalPath}`);
    }
  }

  console.log("\nBatch recovery submitted. Check Queue Monitor in Admin Console.");
  await prisma.$disconnect();
  await connection.quit();
}

recover().catch(console.error);
