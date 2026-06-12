import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { Product } from "../../services/productsService";

interface CustomerData {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  company?: string;
  cif?: string;
  callPreference?: string;
  accountNumber?: string;
}

interface OrderProduct {
  id: number;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface Order {
  date: string;
  agent: string;
  subtotal?: number;
  discount_percent?: number;
  discount_amount?: number;
  total: number;
  customer: CustomerData;
  products: OrderProduct[];
  filename?: string;
}

interface EditOrderProps {
  order: Order;
  productsCatalog: Product[];
  getEffectivePrice: (product: Product) => number;
  formatMoney: (value: number) => string;
  formatDateTime: (dateStr: string) => string;
  getOrderPrintId: (order: Order) => string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const normalizeSearchText = (input: string) => {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const EditOrder: React.FC<EditOrderProps> = ({
  order,
  productsCatalog,
  getEffectivePrice,
  formatMoney,
  formatDateTime,
  getOrderPrintId,
  onClose,
  onSaved,
}) => {
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    company: "",
    cif: "",
    callPreference: "",
    accountNumber: "",
  });
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setError("");
    setCustomerData({
      name: order.customer?.name || "",
      email: order.customer?.email || "",
      phone: order.customer?.phone || "",
      address: order.customer?.address || "",
      notes: order.customer?.notes || "",
      company: order.customer?.company || "",
      cif: order.customer?.cif || "",
      callPreference: order.customer?.callPreference || "",
      accountNumber: order.customer?.accountNumber || "",
    });
    setProducts(
      (order.products || []).map((p) => {
        const quantity = Number(p.quantity) || 0;
        const id = Number(p.id) || 0;
        const catalogProduct = productsCatalog.find((cp) => cp.id === id);
        const unitPrice =
          catalogProduct && typeof catalogProduct.price === "number"
            ? getEffectivePrice(catalogProduct)
            : Number(p.price) || 0;
        return {
          id,
          name: catalogProduct ? catalogProduct.name.es : String(p.name || ""),
          quantity,
          price: unitPrice,
          total: unitPrice * quantity,
        };
      }),
    );
    setActiveRowIndex(null);
  }, [order, productsCatalog, getEffectivePrice]);

  const identityKey = useMemo(() => {
    return [
      order.date || "",
      order.agent || "",
      order.customer?.email || "",
      order.customer?.phone || "",
      String(order.total ?? ""),
    ].join("|");
  }, [order]);

  const totals = useMemo(() => {
    const subtotal = products.reduce((acc, p) => {
      const qty = Number(p.quantity) || 0;
      const price = Number(p.price) || 0;
      return acc + qty * price;
    }, 0);

    const discountPercentValue =
      typeof order.discount_percent === "number" ? order.discount_percent : 0;
    const discountAmountValueRaw =
      typeof order.discount_amount === "number" ? order.discount_amount : 0;

    let discountAmount =
      discountPercentValue > 0 ? (subtotal * discountPercentValue) / 100 : 0;
    if (discountPercentValue <= 0 && discountAmountValueRaw > 0) {
      discountAmount = discountAmountValueRaw;
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0)
      discountAmount = 0;
    if (discountAmount > subtotal) discountAmount = subtotal;

    const total = subtotal - discountAmount;
    return { subtotal, discountPercentValue, discountAmount, total };
  }, [products, order.discount_amount, order.discount_percent]);

  const hasInvalidSelection = useMemo(() => {
    return products.some(
      (p) => String(p.name || "").trim() !== "" && Number(p.id) <= 0,
    );
  }, [products]);

  const hasAnyValidProduct = useMemo(() => {
    return products.some(
      (p) => Number(p.id) > 0 && (Number(p.quantity) || 0) > 0,
    );
  }, [products]);

  const canSave = useMemo(() => {
    if (isSaving) return false;
    if (!customerData.name.trim()) return false;
    if (!customerData.phone.trim()) return false;
    if (!customerData.address.trim()) return false;
    if (!hasAnyValidProduct) return false;
    if (hasInvalidSelection) return false;
    return true;
  }, [customerData, hasAnyValidProduct, hasInvalidSelection, isSaving]);

  const close = useCallback(() => {
    if (isSaving) return;
    onClose();
  }, [isSaving, onClose]);

  const addLine = useCallback(() => {
    setProducts((prev) => [
      ...prev,
      { id: 0, name: "", quantity: 1, price: 0, total: 0 },
    ]);
  }, []);

  const save = useCallback(async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError("");

    const normalizedProducts = products
      .map((p) => {
        const name = String(p.name || "").trim();
        const quantity = Number(p.quantity) || 0;
        const price = Number(p.price) || 0;
        return {
          id: Number(p.id) || 0,
          name,
          quantity: quantity < 0 ? 0 : quantity,
          price: price < 0 ? 0 : price,
          total: (quantity < 0 ? 0 : quantity) * (price < 0 ? 0 : price),
        };
      })
      .filter((p) => p.id > 0 && p.name !== "" && p.quantity > 0);

    if (normalizedProducts.length === 0) {
      setError("Añade al menos un producto válido del catálogo.");
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch("/backend/edit_order.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: order.filename,
          agent: order.agent,
          order_key: identityKey,
          updated_order: {
            ...order,
            customer: customerData,
            products: normalizedProducts,
            subtotal: totals.subtotal,
            discount_percent: totals.discountPercentValue,
            discount_amount: totals.discountAmount,
            total: totals.total,
          },
        }),
      });

      if (!response.ok) {
        let msg = "No se pudo editar el pedido.";
        try {
          const data = (await response.json()) as {
            error?: string;
            message?: string;
          };
          if (data?.error) msg = data.error;
          else if (data?.message) msg = data.message;
        } catch {
          void 0;
        }
        setError(msg);
        setIsSaving(false);
        return;
      }

      await Promise.resolve(onSaved());
      onClose();
    } catch (err) {
      console.error("Error editing order:", err);
      setError("Error de conexión al intentar editar el pedido.");
    } finally {
      setIsSaving(false);
    }
  }, [
    canSave,
    customerData,
    identityKey,
    onClose,
    onSaved,
    order,
    products,
    totals,
  ]);

  return (
    <>
      <div
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={close}
      />
      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-black/10 bg-[var(--color-primary)] shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
            <div className="flex items-center gap-2">
              <Pencil size={18} className="text-[var(--color-secondary)]" />
              <h3 className="text-black font-extrabold">Editar pedido</h3>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={isSaving}
              className="h-9 w-9 rounded-full border border-black/10 bg-white/70 text-black/70 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="px-5 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="bg-white/60 border border-black/10 rounded-xl p-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex justify-between gap-4">
                  <span className="text-xs font-bold text-black/60 uppercase tracking-wider">
                    Nº pedido
                  </span>
                  <span className="font-semibold text-black text-right">
                    {getOrderPrintId(order)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-xs font-bold text-black/60 uppercase tracking-wider">
                    Fecha
                  </span>
                  <span className="font-semibold text-black text-right">
                    {formatDateTime(order.date)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-xs font-bold text-black/60 uppercase tracking-wider">
                    Comercial
                  </span>
                  <span className="font-semibold text-black text-right">
                    {order.agent || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-xs font-bold text-black/60 uppercase tracking-wider">
                    Total
                  </span>
                  <span className="font-semibold text-black text-right">
                    {formatMoney(totals.total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                  value={customerData.name}
                  onChange={(e) =>
                    setCustomerData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-2">
                  Teléfono *
                </label>
                <input
                  type="text"
                  className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                  value={customerData.phone}
                  onChange={(e) =>
                    setCustomerData((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-2">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                  value={customerData.email}
                  onChange={(e) =>
                    setCustomerData((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-2">
                  Empresa
                </label>
                <input
                  type="text"
                  className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                  value={customerData.company || ""}
                  onChange={(e) =>
                    setCustomerData((prev) => ({
                      ...prev,
                      company: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-2">
                  CIF
                </label>
                <input
                  type="text"
                  className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors uppercase"
                  value={customerData.cif || ""}
                  onChange={(e) =>
                    setCustomerData((prev) => ({
                      ...prev,
                      cif: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-2">
                  Preferencia de llamada
                </label>
                <input
                  type="text"
                  className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                  value={customerData.callPreference || ""}
                  onChange={(e) =>
                    setCustomerData((prev) => ({
                      ...prev,
                      callPreference: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-2">
                Cuenta corriente
              </label>
              <input
                type="text"
                className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors uppercase"
                value={customerData.accountNumber || ""}
                onChange={(e) =>
                  setCustomerData((prev) => ({
                    ...prev,
                    accountNumber: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-2">
                Dirección *
              </label>
              <textarea
                className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors resize-none h-24"
                value={customerData.address}
                onChange={(e) =>
                  setCustomerData((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-2">
                Notas
              </label>
              <textarea
                className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors resize-none h-24"
                value={customerData.notes}
                onChange={(e) =>
                  setCustomerData((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
            </div>

            <div className="bg-white/60 border border-black/10 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-xs font-bold text-black/60 uppercase tracking-wider">
                  Productos
                </div>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-black/15 text-black hover:bg-black/5 transition-colors text-xs font-semibold"
                >
                  <Plus size={16} />
                  Añadir
                </button>
              </div>

              {products.length === 0 ? (
                <div className="text-sm text-black/60">
                  No hay productos en este pedido.
                </div>
              ) : (
                <div className="space-y-2">
                  {products.map((p, idx) => {
                    const query = String(p.name || "");
                    const normalizedQuery = normalizeSearchText(query);
                    const suggestions = productsCatalog
                      .filter((cp) => {
                        if (!normalizedQuery) return false;
                        return normalizeSearchText(cp.name.es).includes(
                          normalizedQuery,
                        );
                      })
                      .slice(0, 8);
                    const showSuggestions =
                      activeRowIndex === idx &&
                      suggestions.length > 0 &&
                      query.trim() !== "";
                    const unitPrice = Number(p.price) || 0;
                    const lineTotal = (Number(p.quantity) || 0) * unitPrice;

                    return (
                      <div
                        key={`${p.id}-${idx}`}
                        className="grid grid-cols-12 gap-2 items-start md:items-end"
                      >
                        <div className="col-span-12 md:col-span-5 relative">
                          <input
                            type="text"
                            className="w-full bg-white border border-black/15 rounded-lg px-3 py-2 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                            value={p.name}
                            onFocus={() => setActiveRowIndex(idx)}
                            onBlur={() => {
                              window.setTimeout(() => {
                                setActiveRowIndex((cur) =>
                                  cur === idx ? null : cur,
                                );
                              }, 150);
                            }}
                            onChange={(e) =>
                              setProducts((prev) => {
                                const next = [...prev];
                                const qty = Number(next[idx]?.quantity) || 0;
                                next[idx] = {
                                  ...next[idx],
                                  id: 0,
                                  name: e.target.value,
                                  price: 0,
                                  total: qty * 0,
                                };
                                return next;
                              })
                            }
                            placeholder="Busca un producto..."
                          />
                          {showSuggestions && (
                            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[260] bg-white border border-black/10 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                              {suggestions.map((cp) => {
                                const effectivePrice = getEffectivePrice(cp);
                                return (
                                  <button
                                    key={cp.id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setProducts((prev) => {
                                        const next = [...prev];
                                        const qty =
                                          Number(next[idx]?.quantity) || 0;
                                        next[idx] = {
                                          ...next[idx],
                                          id: cp.id,
                                          name: cp.name.es,
                                          price: effectivePrice,
                                          total: effectivePrice * qty,
                                        };
                                        return next;
                                      });
                                      setActiveRowIndex(null);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-black/5 transition-colors"
                                  >
                                    <div className="text-sm font-semibold text-black">
                                      {cp.name.es}
                                    </div>
                                    <div className="text-xs text-black/60">
                                      ID: {cp.id} ·{" "}
                                      {Number(effectivePrice).toFixed(2)} €
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {Number(p.id) <= 0 && query.trim() !== "" && (
                            <div className="text-[11px] text-red-700 mt-1">
                              Selecciona un producto del listado
                            </div>
                          )}
                        </div>

                        <div className="col-span-4 md:col-span-2 flex items-end">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="w-full bg-white border border-black/15 rounded-lg px-3 py-2 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors tabular-nums max-w-[92px] md:max-w-[96px]"
                            value={p.quantity}
                            onChange={(e) =>
                              setProducts((prev) => {
                                const next = [...prev];
                                const raw = parseInt(e.target.value, 10);
                                const qty = Number.isNaN(raw) ? 0 : raw;
                                const price = Number(next[idx]?.price) || 0;
                                next[idx] = {
                                  ...next[idx],
                                  quantity: qty,
                                  total: qty * price,
                                };
                                return next;
                              })
                            }
                            placeholder="Cant."
                          />
                        </div>

                        <div className="col-span-4 md:col-span-2 flex items-end justify-end">
                          <div className="text-right">
                            <div className="text-[11px] uppercase font-bold tracking-wider text-black/50">
                              Precio
                            </div>
                            <div className="text-sm font-bold text-black tabular-nums">
                              {formatMoney(unitPrice)}
                            </div>
                          </div>
                        </div>

                        <div className="col-span-3 md:col-span-2 flex items-end justify-end">
                          <div className="text-right">
                            <div className="text-[11px] uppercase font-bold tracking-wider text-black/50">
                              Total
                            </div>
                            <div className="text-sm font-bold text-[var(--color-secondary)] tabular-nums">
                              {Number.isFinite(lineTotal)
                                ? `${lineTotal.toFixed(2)} €`
                                : "0.00 €"}
                            </div>
                          </div>
                        </div>

                        <div className="col-span-1 flex justify-end items-end">
                          <button
                            type="button"
                            onClick={() =>
                              setProducts((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-black/15 text-black/70 hover:bg-black/5 hover:text-black transition-colors"
                            aria-label="Eliminar producto"
                          >
                            <Trash2 size={16} className="text-red-700" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white/60 border border-black/10 rounded-xl p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-black/70">Subtotal</span>
                <span className="font-semibold text-black">
                  {formatMoney(totals.subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-black/70">Descuento</span>
                <span className="font-semibold text-black">
                  {totals.discountPercentValue > 0
                    ? `${totals.discountPercentValue.toFixed(0)}% (-${formatMoney(
                        totals.discountAmount,
                      )})`
                    : totals.discountAmount > 0
                      ? `-${formatMoney(totals.discountAmount)}`
                      : "0.00 €"}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 text-base">
                <span className="font-extrabold text-black">Total</span>
                <span className="font-extrabold text-[var(--color-secondary)]">
                  {formatMoney(totals.total)}
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-600/10 border border-red-600/20 text-red-700 rounded-xl p-3 text-sm">
                {error}
              </div>
            )}

            {hasInvalidSelection && (
              <div className="bg-red-600/10 border border-red-600/20 text-red-700 rounded-xl p-3 text-sm">
                Selecciona un producto del listado para cada línea.
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl border border-black/15 text-black hover:bg-black/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!canSave}
                className="px-4 py-2 rounded-xl bg-[var(--color-secondary)] text-white hover:brightness-95 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditOrder;
