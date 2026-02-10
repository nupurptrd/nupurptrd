const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const USER_ID = 'user_dev_001';
const WORKSPACE_ID = 'workspace_dev_001';
const BOOK_ID = 'book_dev_001';

async function main() {
  const user = await prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: {
      id: USER_ID,
      name: 'Dev User',
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { id: WORKSPACE_ID },
    update: {},
    create: {
      id: WORKSPACE_ID,
      name: 'Dev Workspace',
    },
  });

  const book = await prisma.book.upsert({
    where: { id: BOOK_ID },
    update: {},
    create: {
      id: BOOK_ID,
      title: 'Moby Dick',
      author: 'Herman Melville',
      language: 'en',
      genre: 'Classic Fiction',
      contentText:
        'Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, ' +
        'and nothing particular to interest me on shore, I thought I would sail about a little and see the watery ' +
        'part of the world. It is a way I have of driving off the spleen and regulating the circulation. ' +
        'Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; ' +
        'then, I account it high time to get to sea as soon as I can.',
      wordCount: 108,
      estimatedPages: 1,
      workspaceId: WORKSPACE_ID,
    },
  });

  console.log('Seeded:');
  console.log({ userId: user.id, workspaceId: workspace.id, bookId: book.id });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
