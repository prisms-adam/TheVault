const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const videos = await prisma.video.findMany({
    where: {
      title: {
        contains: 'Action News'
      }
    }
  });

  if (videos.length === 0) {
    console.log('No videos found containing "Action News".');
  } else {
    videos.forEach(v => {
      console.log(`- ${v.title} (ID: ${v.id}, Status: ${v.status}, Path: ${v.originalPath})`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
