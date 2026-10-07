import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@erp/database";
import type { TenantContext } from "@erp/identity";
import { z } from "zod";

interface RequestContext extends Request {
  requestId: string;
  tenantContext?: TenantContext;
}

const requirePermission = (request: Request): TenantContext => {
  const context = (request as RequestContext).tenantContext;
  if (!context) throw new Error("AuthenticationError");
  return context;
};

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const createReportSchema = z
  .object({
    title: z.string().trim().min(1),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    totalRevenue: z.number().finite().nonnegative(),
    totalExpenses: z.number().finite().nonnegative(),
    netBalance: z.number().finite(),
    totalServicesCount: z.number().int().nonnegative(),
    breakdown: z.object({
      byStatus: z.record(z.string(), z.number().int().nonnegative()),
      byType: z.record(z.string(), z.number().int().nonnegative()),
    }),
  })
  .refine((report) => report.periodStart <= report.periodEnd, {
    message: "periodStart must be before or equal to periodEnd",
    path: ["periodEnd"],
  });

export const createReportsRouter = (authenticated: any) => {
  const router = Router();

  router.post("/", authenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = requirePermission(req);
      const input = createReportSchema.parse(req.body);
      const db = getDatabase();
      const report = {
        id: randomUUID(),
        tenantId: context.tenantId,
        ...input,
        createdAt: new Date(),
      };
      await db.collection("reports").insertOne(report);
      res.status(201).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  });

  router.get("/", authenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = requirePermission(req);
      const db = getDatabase();
      const reports = await db
        .collection("reports")
        .find({ tenantId: context.tenantId })
        .sort({ createdAt: -1 })
        .toArray();
      res.json({ success: true, data: reports });
    } catch (err) {
      next(err);
    }
  });

  router.get("/summary", authenticated, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = requirePermission(req);
      const query = querySchema.parse(req.query);
      const db = getDatabase();

      const matchStage: any = {
        tenantId: context.tenantId,
        isDeleted: { $ne: true },
      };

      if (query.startDate || query.endDate) {
        matchStage.createdAt = {};
        if (query.startDate) matchStage.createdAt.$gte = new Date(query.startDate);
        if (query.endDate) matchStage.createdAt.$lte = new Date(query.endDate);
      }

      const services = await db.collection("services").find(matchStage).toArray();

      let totalRevenue = 0;
      const totalServices = {
        pending: 0,
        in_progress: 0,
        ready: 0,
        delivered: 0,
      };
      const topServicesMap: Record<string, number> = {};

      for (const service of services) {
        // Status counts
        const status = (service.status || "pending").toLowerCase();
        if (status.includes("pending")) totalServices.pending++;
        else if (status.includes("progress") || status.includes("taller"))
          totalServices.in_progress++;
        else if (status.includes("ready")) totalServices.ready++;
        else if (status.includes("delivered") || status.includes("completad"))
          totalServices.delivered++;
        else totalServices.pending++; // fallback

        // Revenue from completed
        if (status.includes("delivered") || status.includes("completad")) {
          totalRevenue += service.totalCost || service.laborCost || 0;
        }

        // Top services
        const type = service.serviceType || "General";
        topServicesMap[type] = (topServicesMap[type] || 0) + 1;
      }

      res.json({
        success: true,
        data: {
          totalRevenue,
          totalServices,
          topServices: topServicesMap,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get(
    "/services/export",
    authenticated,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const context = requirePermission(req);
        const query = querySchema.parse(req.query);
        const db = getDatabase();

        const matchStage: any = {
          tenantId: context.tenantId,
          isDeleted: { $ne: true },
        };

        if (query.startDate || query.endDate) {
          matchStage.createdAt = {};
          if (query.startDate) matchStage.createdAt.$gte = new Date(query.startDate);
          if (query.endDate) matchStage.createdAt.$lte = new Date(query.endDate);
        }

        const services = await db
          .collection("services")
          .find(matchStage)
          .sort({ createdAt: -1 })
          .toArray();

        const headers = [
          "Folio",
          "Cliente",
          "Teléfono",
          "Bicicleta",
          "Servicio",
          "Costo",
          "Estado",
          "Fecha Entrega",
        ];
        const rows = services.map((s) =>
          [
            s.id.substring(0, 8), // short folio
            `"${(s.clientName || "").replace(/"/g, '""')}"`,
            `"${(s.clientPhone || "").replace(/"/g, '""')}"`,
            `"${(s.bikeModel || "").replace(/"/g, '""')}"`,
            `"${(s.serviceType || "").replace(/"/g, '""')}"`,
            s.totalCost || s.laborCost || 0,
            s.status || "pending",
            s.deliveryDate || "",
          ].join(","),
        );

        const csvContent = [headers.join(","), ...rows].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="services_export_${new Date().toISOString().split("T")[0]}.csv"`,
        );
        res.send(csvContent);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
};
