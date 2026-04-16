import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUpsertSubscription = vi.fn().mockResolvedValue(undefined);
const mockSupabaseUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
const mockSupabaseFrom = vi.fn().mockReturnValue({ update: mockSupabaseUpdate });
const mockAdminClient = { from: mockSupabaseFrom };

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

vi.mock("@/lib/billing/upsert-subscription", () => ({
  upsertSubscription: mockUpsertSubscription,
}));

vi.mock("@/lib/payu/client", () => ({
  getPayUConfig: vi.fn(() => ({
    apiKey: "testKey",
    merchantId: "merchant01",
    env: "sandbox",
  })),
  PAYU_PLANS: {
    monthly: { amount: "19900", currency: "COP", description: "Monthly" },
    yearly: { amount: "99900", currency: "COP", description: "Yearly" },
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSignature(amount: string, state: string): string {
  const rounded = `${amount}.0`;
  return createHash("md5")
    .update(`testKey~merchant01~REF-001~${rounded}~COP~${state}`)
    .digest("hex");
}

function buildRequest(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields);
  return new Request("http://localhost/api/webhooks/payu", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

function baseNotification(state: string, extra: Record<string, string> = {}) {
  const sig = makeSignature("19900", state);
  return {
    merchant_id: "merchant01",
    reference_sale: "REF-001",
    reference_pol: "TXN-999",
    sign: sig,
    transaction_id: "TXN-999",
    state_pol: state,
    response_code_pol: "1",
    currency: "COP",
    value: "19900",
    tax: "0",
    additional_value: "0",
    buyer_email: "buyer@example.com",
    payment_method: "1",
    payment_method_name: "VISA",
    payment_method_type: "2",
    installments_number: "1",
    transaction_date: "2026-04-10",
    extra1: "user-uuid-123",
    extra2: "monthly",
    ...extra,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/payu", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import fresh so mocks are applied
    const mod = await import("../route");
    POST = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  it("siempre responde HTTP 200 (PayU requiere esto)", async () => {
    const req = buildRequest(baseNotification("4"));
    const res = await POST(req as never);
    expect(res.status).toBe(200);
  });

  it("responde 200 incluso con firma inválida", async () => {
    const req = buildRequest({
      ...baseNotification("4"),
      sign: "invalidsig",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    // No debe llamar a upsertSubscription si la firma falla
    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });

  it("APPROVED → llama upsertSubscription con status active", async () => {
    const req = buildRequest(baseNotification("4")); // PAYU_STATES.APPROVED = "4"
    await POST(req as never);

    expect(mockUpsertSubscription).toHaveBeenCalledOnce();
    const call = mockUpsertSubscription.mock.calls[0][0];
    expect(call.status).toBe("active");
    expect(call.tier).toBe("premium");
    expect(call.userId).toBe("user-uuid-123");
    expect(call.provider).toBe("payu");
  });

  it("APPROVED → actualiza tier en profiles", async () => {
    const req = buildRequest(baseNotification("4"));
    await POST(req as never);

    expect(mockSupabaseFrom).toHaveBeenCalledWith("profiles");
    expect(mockSupabaseUpdate).toHaveBeenCalledWith({ tier: "premium" });
  });

  it("APPROVED yearly → currentPeriodEnd es ~12 meses después", async () => {
    const notification = baseNotification("4", { extra2: "yearly" });
    // Necesita firma válida con extra2=yearly (la firma no depende de extra2)
    const req = buildRequest(notification);
    await POST(req as never);

    const call = mockUpsertSubscription.mock.calls[0][0];
    const start = new Date(call.currentPeriodStart);
    const end = new Date(call.currentPeriodEnd);
    const diffMonths =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    expect(diffMonths).toBe(12);
  });

  it("APPROVED monthly → currentPeriodEnd es ~1 mes después", async () => {
    const req = buildRequest(baseNotification("4"));
    await POST(req as never);

    const call = mockUpsertSubscription.mock.calls[0][0];
    const start = new Date(call.currentPeriodStart);
    const end = new Date(call.currentPeriodEnd);
    const diffMonths =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    expect(diffMonths).toBe(1);
  });

  it("DECLINED → actualiza subscription a canceled (no upsert)", async () => {
    const sig = makeSignature("19900", "6");
    const req = buildRequest({ ...baseNotification("6"), sign: sig });
    await POST(req as never);

    expect(mockUpsertSubscription).not.toHaveBeenCalled();
    expect(mockSupabaseFrom).toHaveBeenCalledWith("subscriptions");
    expect(mockSupabaseUpdate).toHaveBeenCalledWith({ status: "canceled" });
  });

  it("PENDING → llama upsertSubscription con status incomplete", async () => {
    const sig = makeSignature("19900", "7");
    const req = buildRequest({ ...baseNotification("7"), sign: sig });
    await POST(req as never);

    expect(mockUpsertSubscription).toHaveBeenCalledOnce();
    const call = mockUpsertSubscription.mock.calls[0][0];
    expect(call.status).toBe("incomplete");
  });

  it("sin extra1 (user_id) → responde 200 sin tocar DB", async () => {
    const { extra1: _omit, ...notif } = baseNotification("4") as Record<string, string>;
    // Recalcular firma (la firma no depende de extra1, sigue siendo válida)
    const req = buildRequest(notif);
    await POST(req as never);

    expect(mockUpsertSubscription).not.toHaveBeenCalled();
    expect(mockSupabaseFrom).not.toHaveBeenCalledWith("profiles");
  });

  it("estado ERROR → responde 200 sin modificar DB", async () => {
    const sig = makeSignature("19900", "104");
    const req = buildRequest({ ...baseNotification("104"), sign: sig });
    await POST(req as never);

    expect(mockUpsertSubscription).not.toHaveBeenCalled();
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });
});
