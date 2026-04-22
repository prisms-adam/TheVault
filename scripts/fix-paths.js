const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Starting path migration...');
  const videos = await prisma.video.findMany();
  
  for (const video of videos) {
    let updated = false;
    const data = {};

    if (video.hlsPath && video.hlsPath.startsWith('/vault/')) {
      data.hlsPath = video.hlsPath.replace('/vault/', '/');
      updated = true;
    }

    if (video.thumbnailPath && video.thumbnailPath.startsWith('/vault/')) {
      data.thumbnailPath = video.thumbnailPath.replace('/vault/', '/');
      updated = true;
    }

    if (updated) {
      await prisma.video.update({
        where: { id: video.id },
        data
      });
      console.log(`✅ Fixed paths for video: ${video.title}`);
    }
  }

  console.log('✨ Migration complete.');
  await prisma.$disconnect();
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
