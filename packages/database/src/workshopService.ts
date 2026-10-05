import { type ClientSession, type Db } from "mongodb";

import {
  ALLOWED_STATUS_TRANSITIONS,
  ConflictError,
  NotFoundError,
  ValidationError,
  type InventoryItem,
  type WorkOrder,
  type WorkOrderStatus,
} from "@erp/domain";

import { withTransaction } from "./index.js";

export class WorkshopDomainService {
  /**
   * Reserva atómica de refacciones para una orden de trabajo.
   * Evita condición de carrera descontando stock disponible e incrementando reservado.
   */
  static async reservePartForOrder(orderId: string, sku: string, quantity: number): Promise<void> {
    if (quantity <= 0) throw new ValidationError("Quantity must be greater than 0");

    await withTransaction(async (session: ClientSession, db: Db) => {
      const inventoryCol = db.collection<InventoryItem>("inventory");
      const ordersCol = db.collection<WorkOrder>("work_orders");

      const invUpdate = await inventoryCol.findOneAndUpdate(
        {
          sku,
          $expr: {
            $gte: [{ $subtract: ["$currentStock", "$reservedStock"] }, quantity],
          },
        },
        {
          $inc: { reservedStock: quantity },
          $set: { updatedAt: new Date() },
        },
        { session, returnDocument: "after" },
      );

      if (!invUpdate) {
        throw new ConflictError(`Insufficient available stock for SKU: ${sku}`);
      }

      const updateResult = await ordersCol.updateOne(
        { id: orderId, status: { $nin: ["DELIVERED", "CANCELLED"] } },
        {
          $push: {
            parts: {
              sku,
              name: invUpdate.name,
              quantity,
              unitPrice: invUpdate.salePrice,
              status: "RESERVED",
            },
          },
          $inc: { totalCost: invUpdate.salePrice * quantity },
          $set: { updatedAt: new Date() },
        },
        { session },
      );

      if (updateResult.matchedCount === 0) {
        throw new ConflictError(`Work order ${orderId} is not in a valid state to add parts`);
      }
    });
  }

  /**
   * Validación y transición de la máquina de estados.
   * Si pasa a DELIVERED consolida el descuento; si pasa a CANCELLED libera reservas.
   */
  static async transitionWorkOrderStatus(
    orderId: string,
    nextStatus: WorkOrderStatus,
    userId: string,
    notes?: string,
  ): Promise<void> {
    await withTransaction(async (session: ClientSession, db: Db) => {
      const ordersCol = db.collection<WorkOrder>("work_orders");
      const inventoryCol = db.collection<InventoryItem>("inventory");

      const order = await ordersCol.findOne({ id: orderId }, { session });
      if (!order) throw new NotFoundError("Work order");

      const allowedNext = ALLOWED_STATUS_TRANSITIONS[order.status];
      if (!allowedNext.includes(nextStatus)) {
        throw new ConflictError(
          `Invalid state transition: Cannot move from ${order.status} to ${nextStatus}`,
        );
      }

      if (nextStatus === "DELIVERED") {
        for (const part of order.parts) {
          if (part.status === "RESERVED") {
            await inventoryCol.updateOne(
              { sku: part.sku },
              {
                $inc: {
                  currentStock: -part.quantity,
                  reservedStock: -part.quantity,
                },
                $set: { updatedAt: new Date() },
              },
              { session },
            );
          }
        }
      }

      if (nextStatus === "CANCELLED") {
        for (const part of order.parts) {
          if (part.status === "RESERVED") {
            await inventoryCol.updateOne(
              { sku: part.sku },
              {
                $inc: { reservedStock: -part.quantity },
                $set: { updatedAt: new Date() },
              },
              { session },
            );
          }
        }
      }

      await ordersCol.updateOne(
        { id: orderId },
        {
          $set: {
            status: nextStatus,
            updatedAt: new Date(),
            ...(nextStatus === "DELIVERED" ? { "parts.$[].status": "CONSUMED" } : {}),
          },
          $push: {
            statusHistory: {
              fromStatus: order.status,
              toStatus: nextStatus,
              timestamp: new Date(),
              changedByUserId: userId,
              ...(notes === undefined ? {} : { notes }),
            },
          },
        },
        { session },
      );
    });
  }
}
