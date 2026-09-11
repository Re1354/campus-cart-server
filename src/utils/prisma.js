const { PrismaClient } = require('@prisma/client');

// Singleton PrismaClient — shared across the entire server process
const prisma = new PrismaClient();

module.exports = prisma;
