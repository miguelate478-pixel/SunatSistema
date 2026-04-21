import { Prisma } from "@prisma/client";

// User types
export type User = Prisma.UserGetPayload<object>;
export type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    companyRoles: {
      include: {
        company: true;
        role: true;
      };
    };
  };
}>;

export type CompanyRole = UserWithRoles["companyRoles"][number];

// Company types
export type Company = Prisma.CompanyGetPayload<object>;
export type CompanyWithRelations = Prisma.CompanyGetPayload<{
  include: {
    createdBy: true;
    userRoles: {
      include: {
        user: true;
        role: true;
      };
    };
  };
}>;

// Voucher types
export type Voucher = Prisma.VoucherGetPayload<object>;
export type VoucherWithItems = Prisma.VoucherGetPayload<{
  include: {
    items: true;
    documents: true;
    detraction: true;
  };
}>;
export type VoucherWithAll = Prisma.VoucherGetPayload<{
  include: {
    items: true;
    documents: true;
    detraction: true;
    supplier: true;
    customer: true;
    company: true;
    createdBy: true;
  };
}>;

// Alert types
export type Alert = Prisma.AlertGetPayload<object>;
export type AlertWithRelations = Prisma.AlertGetPayload<{
  include: {
    company: true;
    createdBy: true;
  };
}>;

// Account types
export type AccountReceivable = Prisma.AccountReceivableGetPayload<object>;
export type AccountPayable = Prisma.AccountPayableGetPayload<object>;

// Detraction types
export type Detraction = Prisma.DetractionGetPayload<object>;
export type DetractionWithVoucher = Prisma.DetractionGetPayload<{
  include: {
    voucher: {
      include: {
        items: true;
      };
    };
  };
}>;

// Role types
export type Role = Prisma.RoleGetPayload<object>;
export type UserCompanyRole = Prisma.UserCompanyRoleGetPayload<object>;

// Supplier & Customer types
export type Supplier = Prisma.SupplierGetPayload<object>;
export type Customer = Prisma.CustomerGetPayload<object>;

// Report types
export type ReportExecution = Prisma.ReportExecutionGetPayload<object>;

// Download Job types
export type DownloadJob = Prisma.DownloadJobGetPayload<object>;

// Audit Log types
export type AuditLog = Prisma.AuditLogGetPayload<object>;
