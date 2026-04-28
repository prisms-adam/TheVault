const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const videos = await prisma.video.findMany({
    where: { status: 'ERROR' }
  });

  if (videos.length === 0) {
    console.log('No videos found with ERROR status.');
  } else {
    videos.forEach(v => {
      console.log(`- ${v.title} (ID: ${v.id}, Path: ${v.originalPath}, Created: ${v.createdAt})`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
