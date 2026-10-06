import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@erp/database";
import { DomainError } from "@erp/domain";
import type { TenantContext } from "@erp/identity";
import { sseEmitter } from "../../sse.js";

// Helper type and function simulating what main.ts does
interface RequestContext extends Request {
  requestId: string;
  tenantContext?: TenantContext;
}

const requirePermission = (request: Request): TenantContext => {
  const context = (request as RequestContext).tenantContext;
  if (!context) throw new Error("AuthenticationError");
  return context;
};

const createServiceSchema = z.object({
  clientName: z.string().min(1),
  clientPhone: z.string().min(1),
  bikeModel: z.string().min(1),
  serviceType: z.string().min(1),
  notes: z.string().optional().default(""),
  deliveryDate: z.string().min(1),
});

const updateServiceStatusSchema = z.object({
  status: z.string().min(1),
});

const updateServiceSchema = z.object({
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  bikeModel: z.string().optional(),
  serviceType: z.string().optional(),
  notes: z.string().optional(),
  deliveryDate: z.string().optional(),
  status: z.string().optional(),
  laborCost: z.number().optional(),
  parts: z
    .array(
      z.object({
        sku: z.string(),
        name: z.string(),
        quantity: z.number(),
        price: z.number(),
      }),
    )
    .optional(),
  totalCost: z.number().optional(),
});

export const createServicesRouter = (authenticated: any) => {
  const router = Router();

  router.get("/", authenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = requirePermission(req);
      const db = getDatabase();
      const services = await db
        .collection("services")
        .find({ tenantId: context.tenantId, isDeleted: { $ne: true } })
        .toArray();
      // Notice: Android expects direct array according to ApiService.kt GET return type
      // But main.ts wraps everything in { success: true, data: ... }. We'll just return the array to match Android's Retrofit expectation if it wasn't modified.
      // Wait, ApiService: `suspend fun getServices(): List<BikeServiceDto>` - YES, direct array.
      res.json(services);
    } catch (err) {
      next(err);
    }
  });

  router.post("/", authenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = requirePermission(req);
      const input = createServiceSchema.parse(req.body);
      const db = getDatabase();
      const service = {
        id: randomUUID(),
        tenantId: context.tenantId,
        ...input,
        status: "pending",
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection("services").insertOne(service);

      sseEmitter.emit(context.tenantId, "service_created", service);

      res.status(201).json(service);
    } catch (err) {
      next(err);
    }
  });

  router.patch(
    "/:id/status",
    authenticated,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const context = requirePermission(req);
        const id = req.params.id;
        const input = updateServiceStatusSchema.parse(req.body);
        const db = getDatabase();

        const service = await db
          .collection("services")
          .findOne({ id, tenantId: context.tenantId, isDeleted: { $ne: true } });

        if (!service) throw new DomainError("NOT_FOUND", "Service not found");

        await db
          .collection("services")
          .updateOne({ id }, { $set: { status: input.status, updatedAt: new Date() } });

        const updatedService = { ...service, status: input.status };
        sseEmitter.emit(context.tenantId, "service_updated", updatedService);

        res.json(updatedService);
      } catch (err) {
        next(err);
      }
    },
  );

  router.put("/:id", authenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = requirePermission(req);
      const id = req.params.id;
      const input = updateServiceSchema.parse(req.body);
      const db = getDatabase();

      const service = await db
        .collection("services")
        .findOne({ id, tenantId: context.tenantId, isDeleted: { $ne: true } });

      if (!service) throw new DomainError("NOT_FOUND", "Service not found");

      const updateData = {
        ...input,
        updatedAt: new Date(),
      };

      await db.collection("services").updateOne({ id }, { $set: updateData });

      const updatedService = { ...service, ...updateData };
      sseEmitter.emit(context.tenantId, "service_updated", updatedService);

      res.json(updatedService);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", authenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = requirePermission(req);
      const id = req.params.id;
      const db = getDatabase();

      const service = await db
        .collection("services")
        .findOne({ id, tenantId: context.tenantId, isDeleted: { $ne: true } });

      if (!service) throw new DomainError("NOT_FOUND", "Service not found");

      await db
        .collection("services")
        .updateOne({ id }, { $set: { isDeleted: true, updatedAt: new Date() } });

      sseEmitter.emit(context.tenantId, "service_deleted", { id });

      // Return standard response for DELETE
      res.status(200).json({ success: true, message: "Servicio eliminado" });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
