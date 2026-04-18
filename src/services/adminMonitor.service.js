import { db } from "../models/db.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalizePage(value) {
  const current = Number(value || DEFAULT_PAGE);
  if (!Number.isFinite(current) || current < 1) return DEFAULT_PAGE;
  return Math.floor(current);
}

function normalizePageSize(value) {
  const current = Number(value || DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(current) || current < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(current), MAX_PAGE_SIZE);
}

function parseDateOrNull(value, { endOfDay = false } = {}) {
  if (!value) return null;

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

function buildPaymentWhere(filters = {}) {
  const where = {};

  if (filters.tenantId) {
    where.tenantId = filters.tenantId;
  }

  if (filters.status) {
    where.status = String(filters.status);
  }

  if (filters.provider) {
    where.provider = String(filters.provider);
  }

  if (filters.search) {
    const search = String(filters.search).trim();
    if (search) {
      where.OR = [
        { provider_payment_id: { contains: search, mode: "insensitive" } },
        { cbte_nro: { contains: search, mode: "insensitive" } },
        { customer: { contains: search, mode: "insensitive" } },
        { customer_doc_number: { contains: search, mode: "insensitive" } },
      ];
    }
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};

    const from = parseDateOrNull(filters.dateFrom);
    const to = parseDateOrNull(filters.dateTo, { endOfDay: true });

    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  return where;
}

function buildAmountSummary(result = []) {
  return result.reduce((acc, row) => {
    const amount = Number(row._sum.amount || 0);
    acc.totalAmount += amount;
    acc.statuses[row.status] = {
      count: row._count._all,
      amount,
    };
    return acc;
  }, {
    totalAmount: 0,
    statuses: {},
  });
}

export async function getAdminDashboardSummary() {
  const [
    tenantCount,
    activeTenantCount,
    paymentCount,
    pendingCount,
    failedCount,
    completeCount,
    tenantsWithErrors,
    paymentsByStatus,
    recentPayments,
  ] = await Promise.all([
    db.tenant.count(),
    db.tenant.count({ where: { status: "ACTIVE" } }),
    db.payment.count(),
    db.payment.count({
      where: {
        status: {
          in: ["pending", "processing", "afip_pending", "pdf_pending", "drive_pending", "sheets_pending"],
        },
      },
    }),
    db.payment.count({ where: { status: "failed" } }),
    db.payment.count({ where: { status: "complete" } }),
    db.tenant.count({
      where: {
        payments: {
          some: {
            status: "failed",
          },
        },
      },
    }),
    db.payment.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.payment.findMany({
      take: 10,
      orderBy: [{ createdAt: "desc" }],
      include: {
        tenant: {
          select: { id: true, slug: true, name: true },
        },
      },
    }),
  ]);

  return {
    tenants: {
      total: tenantCount,
      active: activeTenantCount,
      withErrors: tenantsWithErrors,
    },
    payments: {
      total: paymentCount,
      pending: pendingCount,
      failed: failedCount,
      complete: completeCount,
      ...buildAmountSummary(paymentsByStatus),
    },
    recentPayments,
  };
}

export async function listAdminPayments(filters = {}) {
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const where = buildPaymentWhere(filters);

  const [items, total] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    }),
    db.payment.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    filters: {
      tenantId: filters.tenantId ? String(filters.tenantId) : null,
      status: filters.status || null,
      provider: filters.provider || null,
      search: filters.search || null,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
    },
  };
}

export async function getAdminTenantSummary(tenantId) {
  const [
    totalPayments,
    paymentsByStatus,
    recentPayments,
    latestFailedPayment,
  ] = await Promise.all([
    db.payment.count({ where: { tenantId } }),
    db.payment.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.payment.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "desc" }],
      take: 10,
    }),
    db.payment.findFirst({
      where: {
        tenantId,
        status: "failed",
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
  ]);

  return {
    totalPayments,
    latestFailedPayment,
    recentPayments,
    ...buildAmountSummary(paymentsByStatus),
  };
}

export async function getAdminPaymentDetail(paymentId, tenantId = null) {
  const include = {
    tenant: {
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        subscriptions: {
          include: {
            plan: true,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1,
        },
      },
    },
    events: {
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    },
  };

  if (tenantId) {
    return db.payment.findUnique({
      where: { id_tenantId: { id: paymentId, tenantId } },
      include,
    });
  }

  return db.payment.findFirst({
    where: { id: paymentId },
    include,
  });
}
