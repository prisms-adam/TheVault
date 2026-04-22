const prisma = require('../src/db');

async function migrate() {
  const videos = await prisma.video.findMany();
  for (const video of videos) {
    if (video.technicalMetadata) {
      try {
        const metadata = JSON.parse(video.technicalMetadata);
        if (metadata.duration && !video.duration) {
          await prisma.video.update({
            where: { id: video.id },
            data: { duration: parseFloat(metadata.duration) }
          });
          console.log(`Updated duration for video: ${video.id}`);
        }
      } catch (e) {
        console.error(`Failed to parse metadata for video: ${video.id}`);
      }
    }
  }
}

migrate()
  .then(() => console.log('Migration complete'))
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
