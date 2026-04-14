const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function promote() {
  const username = 'Admin'; // Based on your HTML
  try {
    const user = await prisma.user.update({
      where: { username },
      data: { isAdmin: true }
    });
    console.log(`SUCCESS: User "${username}" has been promoted to MASTER ADMIN.`);
  } catch (err) {
    console.error(`ERROR: Could not find user "${username}". Check the spelling (case-sensitive).`);
  } finally {
    await prisma.$disconnect();
  }
}

promote();
