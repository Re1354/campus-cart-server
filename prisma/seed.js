const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Seed the admin user.
  // passwordHash is null intentionally — admin auth method (OAuth vs credentials)
  // will be decided and implemented in a later phase.
  const admin = await prisma.user.upsert({
    where: { email: 'admin@campuscart.com' },
    update: {},
    create: {
      name: 'Campus Cart Admin',
      email: 'admin@campuscart.com',
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user seeded:', admin.email);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
