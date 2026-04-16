"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { PSEBank, PSEDocumentType, PSEPersonType } from "@/lib/pse/types";
import type { PayUPlan } from "@/lib/payu/types";

interface PSEFormProps {
  banks: PSEBank[];
  plan: PayUPlan;
  planLabel: string;
  planAmount: string;
}

const DOCUMENT_TYPES: { value: PSEDocumentType; label: string }[] = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "NIT", label: "NIT" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "PP", label: "Pasaporte" },
  { value: "RC", label: "Registro civil" },
  { value: "DE", label: "Documento extranjero" },
];

export function PSEForm({ banks, plan, planLabel, planAmount }: PSEFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    documentType: "CC" as PSEDocumentType,
    documentNumber: "",
    phone: "",
    personType: "N" as PSEPersonType,
    financialInstitutionCode: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.financialInstitutionCode) {
      setError("Selecciona tu banco.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout-pse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          ...form,
          ipAddress: "", // El servidor usa x-forwarded-for como fallback
          userAgent: navigator.userAgent,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.bankUrl) {
        setError(data.error ?? "No se pudo iniciar el pago. Inténtalo de nuevo.");
        return;
      }

      // Redirigir al portal bancario
      window.location.href = data.bankUrl;
    } catch {
      setError("Error de red. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Resumen del plan */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium">{planLabel}</p>
        <p className="text-2xl font-bold tabular-nums">{planAmount} COP</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Débito bancario · PSE · Colombia
        </p>
      </div>

      {/* Tipo de persona */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tipo de persona</legend>
        <div className="flex gap-3">
          {(
            [
              { value: "N", label: "Natural" },
              { value: "J", label: "Jurídica" },
            ] as { value: PSEPersonType; label: string }[]
          ).map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                form.personType === opt.value
                  ? "border-value bg-value/10 text-value"
                  : "border-border text-muted-foreground hover:border-muted-foreground",
              )}
            >
              <input
                type="radio"
                name="personType"
                value={opt.value}
                checked={form.personType === opt.value}
                onChange={handleChange}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Nombre completo */}
      <div className="space-y-1.5">
        <label htmlFor="fullName" className="text-sm font-medium">
          Nombre completo
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          placeholder="Como aparece en tu documento"
          value={form.fullName}
          onChange={handleChange}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-value focus:ring-1 focus:ring-value/30"
        />
      </div>

      {/* Tipo + Número de documento */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="documentType" className="text-sm font-medium">
            Tipo de documento
          </label>
          <select
            id="documentType"
            name="documentType"
            value={form.documentType}
            onChange={handleChange}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-value focus:ring-1 focus:ring-value/30"
          >
            {DOCUMENT_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>
                {dt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="documentNumber" className="text-sm font-medium">
            Número de documento
          </label>
          <input
            id="documentNumber"
            name="documentNumber"
            type="text"
            required
            inputMode="numeric"
            placeholder="Sin puntos ni guiones"
            value={form.documentNumber}
            onChange={handleChange}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-value focus:ring-1 focus:ring-value/30"
          />
        </div>
      </div>

      {/* Teléfono */}
      <div className="space-y-1.5">
        <label htmlFor="phone" className="text-sm font-medium">
          Teléfono de contacto
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="3001234567"
          value={form.phone}
          onChange={handleChange}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-value focus:ring-1 focus:ring-value/30"
        />
      </div>

      {/* Banco */}
      <div className="space-y-1.5">
        <label htmlFor="financialInstitutionCode" className="text-sm font-medium">
          Banco
        </label>
        {banks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No se pudo cargar la lista de bancos. Recarga la página.
          </p>
        ) : (
          <select
            id="financialInstitutionCode"
            name="financialInstitutionCode"
            required
            value={form.financialInstitutionCode}
            onChange={handleChange}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-value focus:ring-1 focus:ring-value/30"
          >
            <option value="">Selecciona tu banco…</option>
            {banks.map((bank) => (
              <option key={bank.pseCode} value={bank.pseCode}>
                {bank.description}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="value"
        size="lg"
        className="w-full"
        disabled={loading}
      >
        {loading ? "Redirigiendo a tu banco…" : "Pagar con PSE"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Serás redirigido al portal seguro de tu banco para autorizar el débito.
        <br />
        El resultado puede tardar unos minutos en reflejarse.
      </p>
    </form>
  );
}
