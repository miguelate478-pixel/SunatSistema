import prisma from "@/lib/db/prisma";
import { SunatClient } from "./sunat-client";
import { parseXmlFromZipBuffer } from "./xml-processor";

export class TicketPoller {
  private static instance: TicketPoller;
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  static getInstance(): TicketPoller {
    if (!TicketPoller.instance) {
      TicketPoller.instance = new TicketPoller();
    }
    return TicketPoller.instance;
  }

  async startPolling(ticketId: string, companyId: string, sunatCredentialId: string): Promise<void> {
    if (this.pollingIntervals.has(ticketId)) {
      return; // Already polling
    }

    const interval = setInterval(async () => {
      try {
        await this.checkAndProcessTicket(ticketId, companyId, sunatCredentialId);
      } catch (error) {
        console.error(`Error polling ticket ${ticketId}:`, error);
      }
    }, 5000); // Poll every 5 seconds

    this.pollingIntervals.set(ticketId, interval);
  }

  stopPolling(ticketId: string): void {
    const interval = this.pollingIntervals.get(ticketId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(ticketId);
    }
  }

  private async checkAndProcessTicket(
    ticketId: string,
    companyId: string,
    sunatCredentialId: string
  ): Promise<void> {
    try {
      const currentTicket = await prisma.downloadJob.findUnique({
        where: { id: ticketId },
      });

      if (!currentTicket) {
        this.stopPolling(ticketId);
        return;
      }

      const credentials = await prisma.sunatCredential.findUnique({
        where: { id: sunatCredentialId },
      });

      if (!credentials) {
        throw new Error("Credentials not found");
      }

      const client = new SunatClient(
        credentials.clientId,
        credentials.clientSecret,
        credentials.ruc,
        credentials.usuario,
        credentials.claveSol
      );

      // Descarga directa
      if (currentTicket.numTicket.startsWith("DIRECT_")) {
        await this.processCompletedTicket(
          ticketId,
          companyId,
          client,
          currentTicket.numTicket,
          currentTicket.tipo,
          currentTicket.periodo,
          {}
        );
        this.stopPolling(ticketId);
        return;
      }

      const codLibro = currentTicket.tipo === "propuesta-ventas" ? "140000" : "080000";
      const status = await client.checkTicketStatus(currentTicket.numTicket, currentTicket.periodo, codLibro);

      const estadoTerminado = status.estado === "Terminado" || [3, 4].includes(status.codEstadoProceso ?? -1);
      const primerArchivo = status.archivoReporte?.[0];
      const nomArchivo = primerArchivo?.nomArchivoReporte ?? status.nomArchivoReporte;

      if (estadoTerminado && nomArchivo) {
        await this.processCompletedTicket(
          ticketId,
          companyId,
          client,
          nomArchivo,
          currentTicket.tipo,
          currentTicket.periodo,
          {
            codTipoArchivoReporte: primerArchivo?.codTipoAchivoReporte ?? null,
            codProceso: status.codProceso,
            numTicket: status.numTicket,
            codLibro: status.codLibro ?? "080000",
            perTributario: status.perTributario ?? currentTicket.periodo,
          }
        );
        this.stopPolling(ticketId);
      } else if (["Error", "error", "ERROR"].includes(status.estado)) {
        await prisma.downloadJob.update({
          where: { id: ticketId },
          data: {
            status: "FAILED",
            errorMessage: "Error en SUNAT",
            progress: 0,
          },
        });
        this.stopPolling(ticketId);
      } else {
        const progreso = ["Procesando", "En Proceso", "En proceso"].includes(status.estado) ? 50 : 25;
        await prisma.downloadJob.update({
          where: { id: ticketId },
          data: {
            status: "RUNNING",
            progress: progreso,
          },
        });
      }
    } catch (error) {
      console.error("Error in checkAndProcessTicket:", error);
      await prisma.downloadJob.update({
        where: { id: ticketId },
        data: {
          status: "FAILED",
          errorMessage: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          progress: 0,
        },
      });
      this.stopPolling(ticketId);
    }
  }

  private async processCompletedTicket(
    ticketId: string,
    companyId: string,
    client: SunatClient,
    nomArchivoReporte: string,
    tipo: string,
    periodoTributario: string,
    extra?: {
      codTipoArchivoReporte?: string | null;
      codProceso?: string;
      numTicket?: string;
      codLibro?: string;
      perTributario?: string;
    }
  ): Promise<void> {
    try {
      const zipBuffer = await client.downloadFile(nomArchivoReporte, extra);
      const comprobantes = await parseXmlFromZipBuffer(zipBuffer, tipo);

      const totalIGV = comprobantes.reduce((s, c) => s + parseFloat(c.igv || "0"), 0);
      const totalImporte = comprobantes.reduce((s, c) => s + parseFloat(c.importeTotal || "0"), 0);

      // Actualizar el job
      await prisma.downloadJob.update({
        where: { id: ticketId },
        data: {
          status: "SUCCESS",
          progress: 100,
          completedAt: new Date(),
          resultData: {
            totalRegistros: comprobantes.length,
            totalIGV: totalIGV.toFixed(2),
            totalImporte: totalImporte.toFixed(2),
          },
        },
      });

      // Guardar comprobantes en la base de datos
      if (comprobantes.length > 0) {
        // Obtener el RUC real de la empresa
        const company = await prisma.company.findUnique({
          where: { id: companyId },
          select: { ruc: true, razonSocial: true },
        });

        if (!company) {
          throw new Error("Company not found");
        }

        // Determinar dirección del comprobante
        const esVenta = tipo === "propuesta-ventas";
        const direccion = esVenta ? "VENTA" : "COMPRA";

        const vouchersToCreate = comprobantes.map((c) => {
          // LÓGICA CORRECTA según tipo:
          // - COMPRAS: empresa es receptora, proveedor es emisor
          // - VENTAS: empresa es emisora, cliente es receptor
          let rucEmisor: string;
          let razonSocialEmisor: string;
          let rucReceptor: string;
          let razonSocialReceptor: string;

          if (esVenta) {
            // VENTAS: empresa emite, cliente recibe
            rucEmisor = company.ruc;
            razonSocialEmisor = company.razonSocial;
            rucReceptor = c.rucEmisor || ""; // Del XML viene el cliente
            razonSocialReceptor = c.razonSocial || "";
          } else {
            // COMPRAS: proveedor emite, empresa recibe
            rucEmisor = c.rucEmisor || "";
            razonSocialEmisor = c.razonSocial || "";
            rucReceptor = company.ruc;
            razonSocialReceptor = company.razonSocial;
          }

          return {
            companyId,
            serie: c.serie || "",
            numero: c.numero || "",
            tipo: this.mapTipoComprobante(c.tipoComprobante || ""),
            rucEmisor,
            razonSocialEmisor,
            rucReceptor,
            razonSocialReceptor,
            fechaEmision: this.parseDate(c.fechaEmision),
            subtotal: parseFloat(c.baseImponible || "0"),
            igv: parseFloat(c.igv || "0"),
            total: parseFloat(c.importeTotal || "0"),
            moneda: c.moneda || "PEN",
            estado: "ACEPTADO",
            tieneXML: true,
            tienePDF: false,
            tieneCDR: false,
            afectoDetraccion: false,
            direccion,
            createdById: null,
            downloadJobId: ticketId, // ← Último job
          };
        });

        // 1. Insertar nuevos vouchers en lotes
        const batchSize = 100;
        let totalInserted = 0;
        
        for (let i = 0; i < vouchersToCreate.length; i += batchSize) {
          const batch = vouchersToCreate.slice(i, i + batchSize);
          const result = await prisma.voucher.createMany({
            data: batch,
            skipDuplicates: true,
          });
          totalInserted += result.count;
        }

        console.log(`[TicketPoller] Insertados ${totalInserted} vouchers nuevos de ${vouchersToCreate.length} totales`);

        // 2. Obtener TODOS los vouchers (nuevos + existentes)
        const voucherKeys = vouchersToCreate.map(v => ({
          companyId,
          tipo: v.tipo,
          serie: v.serie,
          numero: v.numero,
        }));

        const allVouchers = await prisma.voucher.findMany({
          where: {
            OR: voucherKeys,
          },
          select: { 
            id: true, 
            serie: true, 
            numero: true, 
            tipo: true,
            downloadJobId: true, // ← Para saber si ya tenía un job anterior
          },
        });

        console.log(`[TicketPoller] Total vouchers encontrados: ${allVouchers.length}`);

        // 3. Actualizar downloadJobId al último job (referencia rápida)
        await prisma.voucher.updateMany({
          where: {
            id: { in: allVouchers.map(v => v.id) },
          },
          data: {
            downloadJobId: ticketId, // ← Actualizar al último job
          },
        });

        console.log(`[TicketPoller] Actualizados downloadJobId en ${allVouchers.length} vouchers`);

        // 4. Crear vínculos en tabla puente (preserva historial)
        const jobVoucherLinks = allVouchers.map(v => {
          const wasNew = vouchersToCreate.some(vc => 
            vc.tipo === v.tipo && vc.serie === v.serie && vc.numero === v.numero
          ) && totalInserted > 0;

          return {
            downloadJobId: ticketId,
            voucherId: v.id,
            wasNew,
            dataChanged: false, // TODO: comparar datos si es necesario
          };
        });

        await prisma.downloadJobVoucher.createMany({
          data: jobVoucherLinks,
          skipDuplicates: true, // Por si se reintenta el mismo job
        });

        console.log(`[TicketPoller] Creados ${jobVoucherLinks.length} vínculos en tabla puente`);

        // 5. Crear/actualizar documentos XML
        for (const voucher of allVouchers) {
          const doc = await prisma.voucherDocument.upsert({
            where: {
              voucherId_tipo: {
                voucherId: voucher.id,
                tipo: "XML",
              },
            },
            update: {
              downloadJobId: ticketId, // ← Actualizar al último job
            },
            create: {
              voucherId: voucher.id,
              downloadJobId: ticketId, // ← Último job
              tipo: "XML",
              filename: `${voucher.serie}-${voucher.numero}.xml`,
              filepath: `/storage/xml/${periodoTributario}/${voucher.serie}-${voucher.numero}.xml`,
              filesize: 1024,
              mimeType: "application/xml",
              storageUrl: null,
            },
          });

          // 6. Crear vínculo en tabla puente de documentos
          await prisma.downloadJobDocument.upsert({
            where: {
              downloadJobId_voucherDocumentId: {
                downloadJobId: ticketId,
                voucherDocumentId: doc.id,
              },
            },
            update: {},
            create: {
              downloadJobId: ticketId,
              voucherDocumentId: doc.id,
            },
          });
        }

        console.log(`[TicketPoller] Creados/actualizados ${allVouchers.length} documentos XML con vínculos`);

        // 7. Actualizar job con resultados detallados
        await prisma.downloadJob.update({
          where: { id: ticketId },
          data: {
            status: "SUCCESS",
            progress: 100,
            completedAt: new Date(),
            resultData: {
              totalRegistros: comprobantes.length,
              totalNuevos: totalInserted,
              totalExistentes: comprobantes.length - totalInserted,
              totalVinculados: allVouchers.length,
              totalIGV: totalIGV.toFixed(2),
              totalImporte: totalImporte.toFixed(2),
            },
          },
        });
      } else {
        // Sin comprobantes
        await prisma.downloadJob.update({
          where: { id: ticketId },
          data: {
            status: "SUCCESS",
            progress: 100,
            completedAt: new Date(),
            resultData: {
              totalRegistros: 0,
              totalNuevos: 0,
              totalExistentes: 0,
              totalVinculados: 0,
              totalIGV: "0.00",
              totalImporte: "0.00",
            },
          },
        });
      }
    } catch (error) {
      console.error("Error processing completed ticket:", error);
      await prisma.downloadJob.update({
        where: { id: ticketId },
        data: {
          status: "FAILED",
          errorMessage: `Error procesando archivo: ${error instanceof Error ? error.message : "Unknown error"}`,
          progress: 0,
        },
      });
    }
  }

  private mapTipoComprobante(tipo: string): string {
    const mapping: Record<string, string> = {
      "01": "FACTURA",
      "03": "BOLETA",
      "07": "NOTA_CREDITO",
      "08": "NOTA_DEBITO",
    };
    return mapping[tipo] || "FACTURA";
  }

  private parseDate(dateStr: string | undefined): Date {
    if (!dateStr) return new Date();
    // Format: DD/MM/YYYY or YYYY-MM-DD
    if (dateStr.includes("/")) {
      const [day, month, year] = dateStr.split("/");
      return new Date(`${year}-${month}-${day}`);
    }
    return new Date(dateStr);
  }
}

export function getTicketPoller(): TicketPoller {
  return TicketPoller.getInstance();
}
