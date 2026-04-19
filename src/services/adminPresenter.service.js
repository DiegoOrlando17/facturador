function parseConfigSummary(config = {}) {
  const keys = Object.keys(config || {});
  return {
    configured: keys.length > 0,
    configuredKeys: keys,
  };
}

export function summarizeIntegration(integration) {
  const configSummary = parseConfigSummary(integration.config);
  const health = !integration.enabled
    ? "disabled"
    : configSummary.configured
      ? "configured"
      : "missing_config";

  return {
    id: integration.id,
    provider: integration.provider,
    enabled: integration.enabled,
    health,
    configured: configSummary.configured,
    configuredKeys: configSummary.configuredKeys,
    updatedAt: integration.updatedAt,
  };
}

export function summarizeTenantIntegrations(integrations = []) {
  const items = integrations.map(summarizeIntegration);
  const enabledCount = items.filter((item) => item.enabled).length;
  const configuredCount = items.filter((item) => item.health === "configured").length;
  const needsAttentionCount = items.filter((item) => item.health !== "configured").length;

  const overallHealth = needsAttentionCount > 0
    ? "attention"
    : configuredCount > 0
      ? "healthy"
      : "setup_pending";

  return {
    overallHealth,
    enabledCount,
    configuredCount,
    needsAttentionCount,
    items,
  };
}

export function summarizeSubscription(subscription) {
  if (!subscription) {
    return {
      status: "missing",
      planCode: null,
      planName: null,
      billingProvider: null,
      billingRef: null,
    };
  }

  return {
    id: subscription.id,
    status: subscription.status,
    planCode: subscription.plan?.code ?? null,
    planName: subscription.plan?.name ?? null,
    billingProvider: subscription.billingProvider ?? null,
    billingRef: subscription.billingRef ?? null,
    updatedAt: subscription.updatedAt,
  };
}

export function summarizeTenantListItem(tenant) {
  const currentSubscription = tenant.subscriptions?.[0] ?? null;
  const integrationSummary = summarizeTenantIntegrations(
    (tenant.integrations || []).map((integration) => ({
      ...integration,
      config: integration.secretEnc ? { configured: true } : {},
    }))
  );

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    usersCount: tenant.users?.length ?? 0,
    currentSubscription: summarizeSubscription(currentSubscription),
    integrations: integrationSummary,
  };
}

export function summarizeTenantDetail(tenant, integrations, metrics, notes) {
  const currentSubscription = tenant.subscriptions?.[0] ?? null;

  return {
    identity: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    },
    currentSubscription: summarizeSubscription(currentSubscription),
    users: {
      total: tenant.users?.length ?? 0,
      items: tenant.users ?? [],
    },
    integrations: summarizeTenantIntegrations(integrations),
    metrics,
    notes: {
      total: notes?.length ?? 0,
      items: notes ?? [],
    },
    raw: {
      subscriptions: tenant.subscriptions ?? [],
    },
  };
}

export function buildDashboardCards(summary) {
  return [
    {
      id: "tenants_total",
      label: "Tenants",
      value: summary.tenants.total,
      tone: "neutral",
    },
    {
      id: "payments_total",
      label: "Pagos",
      value: summary.payments.total,
      tone: "neutral",
    },
    {
      id: "payments_complete",
      label: "Completados",
      value: summary.payments.complete,
      tone: "success",
    },
    {
      id: "payments_pending",
      label: "Pendientes",
      value: summary.payments.pending,
      tone: summary.payments.pending > 0 ? "warning" : "success",
    },
    {
      id: "payments_failed",
      label: "Fallidos",
      value: summary.payments.failed,
      tone: summary.payments.failed > 0 ? "danger" : "success",
    },
    {
      id: "amount_total",
      label: "Facturado",
      value: summary.payments.totalAmount,
      tone: "neutral",
    },
  ];
}
