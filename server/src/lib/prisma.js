import { PrismaClient } from "@prisma/client";

// Una sola instancia del cliente en todo el proceso (evita abrir muchos pools).
export const prisma = new PrismaClient();