import 'dotenv/config';

import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function requireEnv(name: 'ADMIN_EMAIL' | 'ADMIN_PASSWORD'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function main() {
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('ADMIN_PASSWORD');

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters long');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existingAdmin = await prisma.admin.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingAdmin) {
    await prisma.admin.update({
      where: { id: existingAdmin.id },
      data: {
        passwordHash,
        refreshTokenHash: null,
        tokenVersion: { increment: 1 },
      },
    });
    console.log(`Updated admin credentials for ${email}`);
    return;
  }

  await prisma.admin.create({
    data: {
      email,
      passwordHash,
    },
  });
  console.log(`Created admin account for ${email}`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
