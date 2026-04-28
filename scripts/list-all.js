const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const videos = await prisma.video.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  });

  videos.forEach(v => {
    console.log(`- ${v.title} (ID: ${v.id}, Status: ${v.status}, Created: ${v.createdAt})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
