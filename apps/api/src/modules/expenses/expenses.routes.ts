import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@erp/database";
import type { TenantContext } from "@erp/identity";

interface RequestContext extends Request {
  requestId: string;
  tenantContext?: TenantContext;
}

const requirePermission = (request: Request): TenantContext => {
  const context = (request as RequestContext).tenantContext;
  if (!context) throw new Error("AuthenticationError");
  return context;
};

const createExpenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().min(1),
  category: z.enum(["refacciones", "herramientas", "operativo"]).optional().default("refacciones"),
  paymentMethod: z.enum(["efectivo", "transferencia", "tarjeta"]).optional().default("efectivo"),
});

export const createExpensesRouter = (authenticated: any) => {
  const router = Router();

  router.get("/", authenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = requirePermission(req);
      const db = getDatabase();
      const expenses = await db
        .collection("expenses")
        .find({ tenantId: context.tenantId })
        .sort({ date: -1, createdAt: -1 })
        .toArray();
      res.json(expenses);
    } catch (err) {
      next(err);
    }
  });

  router.post("/", authenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = requirePermission(req);
      const input = createExpenseSchema.parse(req.body);
      const db = getDatabase();
      const expense = {
        id: randomUUID(),
        tenantId: context.tenantId,
        ...input,
        createdAt: new Date(),
      };
      await db.collection("expenses").insertOne(expense as any);
      res.status(201).json(expense);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", authenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = requirePermission(req);
      const id = req.params.id;
      const db = getDatabase();
      await db.collection("expenses").deleteOne({
        id,
        tenantId: context.tenantId,
      } as any);
      res.status(200).json({ success: true, message: "Gasto eliminado" });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
