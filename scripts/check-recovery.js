const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const video = await prisma.video.findFirst({
    where: {
      title: 'Action News - S4E23',
      status: 'ERROR'
    }
  });

  if (!video) {
    console.log('Video not found or not in ERROR status.');
    return;
  }

  console.log(`Found video: ${video.title} (${video.id})`);
  console.log(`Original path: ${video.originalPath}`);

  if (video.originalPath && fs.existsSync(video.originalPath)) {
    console.log('Original file exists! We can recover it.');
  } else {
    console.log('Original file does NOT exist. Recovery not possible via this method.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
