import type { Response } from "express";

interface Client {
  id: string;
  tenantId: string;
  response: Response;
}

export class SseEmitter {
  private clients: Client[] = [];

  public addClient(id: string, tenantId: string, response: Response): void {
    this.clients.push({ id, tenantId, response });
    response.on("close", () => {
      this.clients = this.clients.filter((c) => c.id !== id);
    });
  }

  public emit(tenantId: string, event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.clients.filter((c) => c.tenantId === tenantId).forEach((c) => c.response.write(payload));
  }
}

export const sseEmitter = new SseEmitter();
