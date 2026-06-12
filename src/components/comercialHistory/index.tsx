import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  History,
  Loader2,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import type { Product } from "../../services/productsService";
import EditOrder from "../editOrder";

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

interface Order {
  date: string;
  agent: string;
  subtotal?: number;
  discount_percent?: number;
  discount_amount?: number;
  total: number;
  customer: CustomerData;
  products: {
    id: number;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  filename?: string;
}

interface ComercialHistoryProps {
  isAdmin: boolean;
  username: string;
  productsCatalog: Product[];
  getEffectivePrice: (product: Product) => number;
  formatMoney: (value: number) => string;
  formatDateTime: (dateStr: string) => string;
  getOrderPrintId: (order: Order) => string;
  onBack: () => void;
  onPrintOrder: (order: Order) => void;
  onPrintMonthSummary: (payload: {
    monthKey: string;
    monthLabel: string;
    generatedAt: string;
    orders: Order[];
    ordersCount: number;
    totalAmount: number;
    hiddenCount: number;
  }) => void;
}

const ALL_MONTH_KEY = "__ALL__";

const normalizeSearchText = (input: string) => {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const getOrderKey = (order: Order) => {
  if (order.filename) return order.filename;
  return [
    order.date || "",
    order.agent || "",
    order.customer?.email || "",
    order.customer?.phone || "",
    String(order.total ?? ""),
  ].join("|");
};

const getMonthKeyFromDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
};

const ComercialHistory: React.FC<ComercialHistoryProps> = ({
  isAdmin,
  username,
  productsCatalog,
  getEffectivePrice,
  formatMoney,
  formatDateTime,
  getOrderPrintId,
  onBack,
  onPrintOrder,
  onPrintMonthSummary,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [deletingOrderKey, setDeletingOrderKey] = useState<string | null>(null);
  const [orderPendingDelete, setOrderPendingDelete] = useState<Order | null>(
    null,
  );
  const [deleteModalError, setDeleteModalError] = useState("");
  const [orderPendingEdit, setOrderPendingEdit] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>(
    {},
  );
  const [showAgentsSummary, setShowAgentsSummary] = useState(true);
  const [adminOrdersSearch, setAdminOrdersSearch] = useState("");
  const [expandedMonthKey, setExpandedMonthKey] = useState(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
  });

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
  }, []);

  const formatMonthLabel = useCallback(
    (monthKey: string) => {
      if (monthKey === ALL_MONTH_KEY) return "Todos los pedidos";
      if (monthKey === "Sin fecha") return "Sin fecha";
      const [y, m] = monthKey.split("-");
      const year = Number(y);
      const month = Number(m);
      if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        month < 1 ||
        month > 12
      ) {
        return monthKey;
      }
      const d = new Date(year, month - 1, 1);
      const label = d.toLocaleString("es-ES", {
        month: "long",
        year: "numeric",
      });
      const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
      if (monthKey === currentMonthKey) return `${capitalized} (mes en curso)`;
      return capitalized;
    },
    [currentMonthKey],
  );

  const fetchOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const url = isAdmin
        ? "https://manpowers.es/backend/get_orders.php"
        : `https://manpowers.es/backend/get_orders.php?agent=${username}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [isAdmin, username]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setExpandedMonthKey(currentMonthKey);
    setExpandedOrders({});
  }, [currentMonthKey]);

  const ordersByMonth = useMemo(() => {
    const map = new Map<string, Order[]>();
    orders.forEach((o) => {
      const key = getMonthKeyFromDate(o.date);
      const prev = map.get(key) || [];
      prev.push(o);
      map.set(key, prev);
    });
    return map;
  }, [orders]);

  const monthKeys = useMemo(() => {
    const keys = new Set<string>(ordersByMonth.keys());
    keys.add(currentMonthKey);
    const list = Array.from(keys);
    return list.sort((a, b) => {
      if (a === "Sin fecha") return 1;
      if (b === "Sin fecha") return -1;
      return b.localeCompare(a);
    });
  }, [ordersByMonth, currentMonthKey]);

  useEffect(() => {
    if (expandedMonthKey === ALL_MONTH_KEY) return;
    if (expandedMonthKey === "Sin fecha") return;
    if (expandedMonthKey === currentMonthKey) return;
    if (monthKeys.includes(expandedMonthKey)) return;
    setExpandedMonthKey(currentMonthKey);
    setExpandedOrders({});
  }, [expandedMonthKey, monthKeys, currentMonthKey]);

  const monthSelectorKeys = useMemo(() => {
    return [ALL_MONTH_KEY, ...monthKeys];
  }, [monthKeys]);

  const allOrdersSorted = useMemo(() => {
    return [...orders].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (Number.isNaN(da) && Number.isNaN(db)) return 0;
      if (Number.isNaN(da)) return 1;
      if (Number.isNaN(db)) return -1;
      return db - da;
    });
  }, [orders]);

  const activeMonthOrders = useMemo(() => {
    if (expandedMonthKey === ALL_MONTH_KEY) return allOrdersSorted;
    const list = ordersByMonth.get(expandedMonthKey) || [];
    return [...list].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (Number.isNaN(da) && Number.isNaN(db)) return 0;
      if (Number.isNaN(da)) return 1;
      if (Number.isNaN(db)) return -1;
      return db - da;
    });
  }, [ordersByMonth, expandedMonthKey, allOrdersSorted]);

  const filteredOrders = useMemo(() => {
    if (!isAdmin) return activeMonthOrders;
    const q = normalizeSearchText(adminOrdersSearch);
    if (!q) return activeMonthOrders;
    return activeMonthOrders.filter((order) => {
      const haystack = [
        order.customer?.name,
        order.customer?.company,
        order.customer?.cif,
        order.customer?.email,
        order.customer?.phone,
        order.customer?.address,
        order.agent,
        order.filename,
        getOrderPrintId(order),
      ]
        .filter(Boolean)
        .join(" ");
      return normalizeSearchText(haystack).includes(q);
    });
  }, [activeMonthOrders, adminOrdersSearch, getOrderPrintId, isAdmin]);

  const monthSummaries = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    monthKeys.forEach((key) => {
      const list = ordersByMonth.get(key) || [];
      const total = list.reduce((sum, o) => {
        if (typeof o.total === "number") return sum + o.total;
        const subtotal =
          o.products?.reduce((acc, p) => acc + p.price * p.quantity, 0) || 0;
        const discountAmount =
          typeof o.discount_amount === "number"
            ? o.discount_amount
            : ((typeof o.discount_percent === "number"
                ? o.discount_percent
                : 0) /
                100) *
              subtotal;
        return sum + (subtotal - discountAmount);
      }, 0);
      map.set(key, { count: list.length, total });
    });
    return map;
  }, [monthKeys, ordersByMonth]);

  const allOrdersSummary = useMemo(() => {
    return {
      count: allOrdersSorted.length,
      total: allOrdersSorted.reduce(
        (sum, o) => sum + (Number(o.total) || 0),
        0,
      ),
    };
  }, [allOrdersSorted]);

  const totalOrdersAmount = useMemo(() => {
    return filteredOrders.reduce((sum, o) => {
      if (typeof o.total === "number") return sum + o.total;
      const subtotal =
        o.products?.reduce((acc, p) => acc + p.price * p.quantity, 0) || 0;
      const discountAmount =
        typeof o.discount_amount === "number"
          ? o.discount_amount
          : ((typeof o.discount_percent === "number" ? o.discount_percent : 0) /
              100) *
            subtotal;
      return sum + (subtotal - discountAmount);
    }, 0);
  }, [filteredOrders]);

  const productsSoldSummary = useMemo(() => {
    const map = new Map<
      string,
      { name: string; quantity: number; amount: number }
    >();
    filteredOrders.forEach((o) => {
      o.products.forEach((p) => {
        const key = p.name.trim();
        const prev = map.get(key);
        const addQty = p.quantity;
        const addAmt = p.price * p.quantity;
        if (prev) {
          prev.quantity += addQty;
          prev.amount += addAmt;
        } else {
          map.set(key, { name: p.name, quantity: addQty, amount: addAmt });
        }
      });
    });
    return Array.from(map.values()).sort(
      (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name),
    );
  }, [filteredOrders]);

  const agentsSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        agent: string;
        ordersCount: number;
        totalUnits: number;
        totalAmount: number;
      }
    >();
    filteredOrders.forEach((o) => {
      const agent = o.agent || "Desconocido";
      const prev = map.get(agent) || {
        agent,
        ordersCount: 0,
        totalUnits: 0,
        totalAmount: 0,
      };
      prev.ordersCount += 1;
      let orderAmount = 0;
      if (typeof o.total === "number") {
        orderAmount = o.total;
      } else {
        const subtotal =
          o.products?.reduce((acc, p) => acc + p.price * p.quantity, 0) || 0;
        const discountAmount =
          typeof o.discount_amount === "number"
            ? o.discount_amount
            : ((typeof o.discount_percent === "number"
                ? o.discount_percent
                : 0) /
                100) *
              subtotal;
        orderAmount = subtotal - discountAmount;
      }
      prev.totalAmount += orderAmount;
      prev.totalUnits +=
        o.products?.reduce((acc, p) => acc + p.quantity, 0) || 0;
      map.set(agent, prev);
    });
    return Array.from(map.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount || a.agent.localeCompare(b.agent),
    );
  }, [filteredOrders]);

  const agentsTotals = useMemo(() => {
    return agentsSummary.reduce(
      (acc, ag) => {
        acc.commercials += 1;
        acc.orders += ag.ordersCount;
        acc.units += ag.totalUnits;
        acc.amount += ag.totalAmount;
        return acc;
      },
      { commercials: 0, orders: 0, units: 0, amount: 0 },
    );
  }, [agentsSummary]);

  const handlePrintMonthSummary = useCallback(() => {
    const nowIso = new Date().toISOString();
    onPrintMonthSummary({
      monthKey: expandedMonthKey,
      monthLabel: formatMonthLabel(expandedMonthKey),
      generatedAt: formatDateTime(nowIso),
      orders: filteredOrders,
      ordersCount: filteredOrders.length,
      totalAmount: totalOrdersAmount,
      hiddenCount: 0,
    });
  }, [
    expandedMonthKey,
    filteredOrders,
    formatDateTime,
    formatMonthLabel,
    onPrintMonthSummary,
    totalOrdersAmount,
  ]);

  const openDeleteOrderModal = useCallback(
    (order: Order) => {
      if (!isAdmin) return;
      if (!order.filename && !order.agent) {
        setDeleteModalError(
          "No se puede eliminar este pedido (falta el comercial/archivo asociado).",
        );
        setOrderPendingDelete(order);
        return;
      }
      setDeleteModalError("");
      setOrderPendingDelete(order);
    },
    [isAdmin],
  );

  const closeDeleteOrderModal = useCallback(() => {
    if (deletingOrderKey) return;
    setDeleteModalError("");
    setOrderPendingDelete(null);
  }, [deletingOrderKey]);

  const handleDeleteOrder = useCallback(
    async (order: Order) => {
      if (!isAdmin) return;
      const orderKey = getOrderKey(order);
      const orderIdentityKey = [
        order.date || "",
        order.agent || "",
        order.customer?.email || "",
        order.customer?.phone || "",
        String(order.total ?? ""),
      ].join("|");

      setDeletingOrderKey(orderKey);
      setDeleteModalError("");
      try {
        const response = await fetch("/backend/delete_order.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: order.filename,
            agent: order.agent,
            order_key: orderIdentityKey,
          }),
        });

        if (!response.ok) {
          let msg = "No se pudo eliminar el pedido.";
          try {
            const data = (await response.json()) as { error?: string };
            if (data?.error) msg = data.error;
          } catch {
            void 0;
          }
          setDeleteModalError(msg);
          return;
        }

        setOrders((prev) => prev.filter((o) => getOrderKey(o) !== orderKey));
        setExpandedOrders((prev) => {
          if (!prev[orderKey]) return prev;
          const next = { ...prev };
          delete next[orderKey];
          return next;
        });
        setOrderPendingDelete(null);
        setDeleteModalError("");
      } catch (err) {
        console.error("Error deleting order:", err);
        setDeleteModalError(
          "Error de conexión al intentar eliminar el pedido.",
        );
      } finally {
        setDeletingOrderKey(null);
      }
    },
    [isAdmin],
  );

  return (
    <>
      <div className="flex flex-col items-center py-10 min-h-[50vh] w-full">
        <div className="w-full sticky top-24 z-10 mb-4 md:mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-black/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-secondary)]/10 flex items-center justify-center text-[var(--color-secondary)]">
                <History size={22} />
              </div>
              <div className="leading-tight">
                <h2 className="text-2xl md:text-3xl font-extrabold text-black tracking-tight">
                  Historial de Pedidos
                </h2>
                <div className="text-xs md:text-sm text-black/60">
                  {formatMonthLabel(expandedMonthKey)}
                </div>
              </div>
            </div>
            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handlePrintMonthSummary}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-secondary)] text-white hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={filteredOrders.length === 0}
                title={
                  filteredOrders.length === 0
                    ? "No hay pedidos para imprimir"
                    : `Imprimir resumen · ${formatMonthLabel(expandedMonthKey)} (1 página A4)`
                }
              >
                <Printer size={18} />
                <span className="truncate max-w-[72vw] md:max-w-none">
                  Imprimir resumen · {formatMonthLabel(expandedMonthKey)}
                </span>
              </button>
              <button
                type="button"
                onClick={onBack}
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-black/15 text-black hover:border-[var(--color-secondary)] hover:text-[var(--color-secondary)] transition-colors"
              >
                <ArrowLeft size={18} /> Volver
              </button>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="w-full mb-4">
            <div className="border border-[var(--color-secondary)]/25 bg-[var(--color-secondary)]/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-bold text-black">
                    Resumen del mes por comerciales
                  </div>
                  <div className="text-sm text-black/60">
                    {formatMonthLabel(expandedMonthKey)} ·{" "}
                    {agentsTotals.commercials} comerciales ·{" "}
                    {agentsTotals.orders} pedidos · {agentsTotals.units} uds ·{" "}
                    {agentsTotals.amount.toFixed(2)} €
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAgentsSummary((v) => !v)}
                  className="shrink-0 px-3 py-2 rounded-lg border border-black/15 text-black hover:bg-black/5 transition-colors text-sm"
                >
                  {showAgentsSummary ? "Ocultar" : "Ver"}
                </button>
              </div>
              {showAgentsSummary && (
                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                  {agentsSummary.map((ag) => (
                    <div
                      key={ag.agent}
                      className="flex justify-between items-center text-sm bg-white/60 p-2 rounded border border-black/10"
                    >
                      <span className="truncate">{ag.agent}</span>
                      <span className="ml-4 whitespace-nowrap text-right">
                        {ag.ordersCount} pedidos · {ag.totalUnits} uds ·{" "}
                        {ag.totalAmount.toFixed(2)} €
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="w-full mb-4">
            <div className="bg-white border border-black/10 rounded-xl p-4 shadow-lg">
              <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-2">
                Buscar pedidos
              </label>
              <input
                type="text"
                className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black placeholder-black/40 focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                placeholder="Cliente, comercial, nº pedido, empresa, CIF, email o dirección..."
                value={adminOrdersSearch}
                onChange={(e) => setAdminOrdersSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="w-full mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {monthSelectorKeys.map((monthKey) => {
              const summary =
                monthKey === ALL_MONTH_KEY
                  ? allOrdersSummary
                  : monthSummaries.get(monthKey) || { count: 0, total: 0 };
              const selected = monthKey === expandedMonthKey;
              return (
                <button
                  key={monthKey}
                  type="button"
                  onClick={() => {
                    setExpandedMonthKey(monthKey);
                    setExpandedOrders({});
                  }}
                  title={`${summary.count} pedidos · ${summary.total.toFixed(2)} €`}
                  className={[
                    "flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg border text-sm shadow-sm transition-colors",
                    selected
                      ? "border-[var(--color-secondary)] bg-[var(--color-secondary)] text-white hover:brightness-110"
                      : "border-black/15 bg-white text-black hover:bg-black/5",
                  ].join(" ")}
                >
                  <span className="font-semibold truncate max-w-[40vw] md:max-w-none">
                    {formatMonthLabel(monthKey)}
                  </span>
                  <span
                    className={[
                      "text-xs",
                      selected ? "text-white/90" : "text-black/60",
                    ].join(" ")}
                  >
                    {summary.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {isLoadingOrders ? (
          <div className="w-full flex justify-center py-16">
            <Loader2
              className="animate-spin text-[var(--color-secondary)]"
              size={30}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-[var(--color-primary)] border border-black/10 rounded-xl px-5 py-4">
                <div className="text-base md:text-lg font-bold text-black">
                  {formatMonthLabel(expandedMonthKey)}
                </div>
                <div className="text-xs md:text-sm text-black/60">
                  {filteredOrders.length} pedidos ·{" "}
                  {totalOrdersAmount.toFixed(2)} €
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="text-sm text-black/60 text-center py-10 border border-black/10 rounded-xl">
                  {isAdmin && adminOrdersSearch.trim()
                    ? "No hay pedidos que coincidan con la búsqueda."
                    : "No hay pedidos en este mes."}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => {
                    const orderKey = getOrderKey(order);
                    const subtotal =
                      typeof order.subtotal === "number"
                        ? order.subtotal
                        : order.products.reduce(
                            (acc, p) => acc + p.price * p.quantity,
                            0,
                          );
                    const discountPercentValue =
                      typeof order.discount_percent === "number"
                        ? order.discount_percent
                        : 0;
                    const discountAmountValue =
                      typeof order.discount_amount === "number"
                        ? order.discount_amount
                        : (subtotal * discountPercentValue) / 100;
                    const isExpanded = !!expandedOrders[orderKey];
                    const d = new Date(order.date);
                    const dateStr = Number.isNaN(d.getTime())
                      ? order.date
                      : `${d.toLocaleDateString("es-ES")} · ${d.toLocaleTimeString("es-ES")}`;

                    return (
                      <div
                        key={orderKey}
                        className="bg-[var(--color-primary)] border border-black/10 rounded-xl p-6 hover:border-[var(--color-secondary)] transition-all"
                      >
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-black/10 pb-4 mb-4">
                          <div>
                            <div className="text-sm text-black/60 mb-1">
                              {dateStr}
                            </div>
                            <h3 className="text-xl font-bold text-black">
                              {order.customer.name}
                            </h3>
                            {order.customer.company && (
                              <div className="text-sm text-[var(--color-secondary)]">
                                {order.customer.company}
                              </div>
                            )}
                            <div className="text-xs text-black/60 mt-1">
                              Comercial:{" "}
                              <span className="font-semibold text-black/80">
                                {order.agent || "N/A"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-2xl font-bold text-[var(--color-secondary)]">
                              {order.total.toFixed(2)} €
                            </div>
                            {discountPercentValue > 0 && (
                              <div className="text-xs text-black/60">
                                Descuento: {discountPercentValue.toFixed(0)}%{" "}
                                {discountAmountValue > 0 && (
                                  <span>
                                    (-{discountAmountValue.toFixed(2)} €)
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="text-xs text-black/60">
                              {order.products.length} productos
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2 text-sm text-black/70">
                            <div className="flex items-center gap-2">
                              <span>📞</span> {order.customer.phone}
                            </div>
                            {order.customer.email && (
                              <div className="flex items-center gap-2">
                                <span>✉️</span> {order.customer.email}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <span>📍</span> {order.customer.address}
                            </div>
                          </div>
                          <div className="bg-black/5 p-3 rounded-lg max-h-32 overflow-y-auto custom-scrollbar border border-black/10">
                            <div className="text-xs text-black/60 mb-2 uppercase font-bold">
                              Resumen
                            </div>
                            {order.products.map((p, i) => (
                              <div
                                key={i}
                                className="flex justify-between text-xs text-black/70 mb-1"
                              >
                                <span>
                                  {p.quantity}x {p.name}
                                </span>
                                <span>
                                  {(p.price * p.quantity).toFixed(2)}€
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setOrderPendingEdit(order)}
                            disabled={!order.filename && !order.agent}
                            title={
                              !order.filename && !order.agent
                                ? "No se puede editar este pedido (falta comercial/archivo asociado)"
                                : "Editar pedido"
                            }
                            className="text-xs md:text-sm px-4 py-2 rounded-lg border border-black/15 text-black hover:bg-black/5 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Pencil size={16} />
                            Editar
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => openDeleteOrderModal(order)}
                              disabled={
                                deletingOrderKey === orderKey ||
                                (!order.filename && !order.agent)
                              }
                              title={
                                !order.filename && !order.agent
                                  ? "No se puede eliminar este pedido (falta comercial/archivo asociado)"
                                  : "Eliminar pedido"
                              }
                              className="text-xs md:text-sm px-4 py-2 rounded-lg border border-red-600/30 text-red-700 hover:bg-red-600/10 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 size={16} />
                              {deletingOrderKey === orderKey
                                ? "Eliminando..."
                                : "Eliminar"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedOrders((prev) => ({
                                ...prev,
                                [orderKey]: !prev[orderKey],
                              }))
                            }
                            className="text-xs md:text-sm px-4 py-2 rounded-lg border border-black/15 text-black hover:bg-black/5 transition-colors"
                          >
                            {isExpanded
                              ? "Ocultar datos completos"
                              : "Ver datos completos"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintOrder(order)}
                            className="text-xs md:text-sm px-4 py-2 rounded-lg bg-[var(--color-secondary)] text-white hover:brightness-95 transition-colors inline-flex items-center gap-2"
                          >
                            <Printer size={16} /> Imprimir
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 border-t border-black/10 pt-4 text-xs md:text-sm text-black/70 space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <div>
                                  <span className="font-semibold">
                                    Comercial:{" "}
                                  </span>
                                  <span>{order.agent}</span>
                                </div>
                                {order.customer.company && (
                                  <div>
                                    <span className="font-semibold">
                                      Empresa:{" "}
                                    </span>
                                    <span>{order.customer.company}</span>
                                  </div>
                                )}
                                <div>
                                  <span className="font-semibold">Email: </span>
                                  <span>{order.customer.email || "N/A"}</span>
                                </div>
                                <div>
                                  <span className="font-semibold">
                                    Teléfono:{" "}
                                  </span>
                                  <span>{order.customer.phone}</span>
                                </div>
                                <div>
                                  <span className="font-semibold">
                                    Dirección:{" "}
                                  </span>
                                  <span>{order.customer.address}</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div>
                                  <span className="font-semibold">
                                    Preferencia de contacto:{" "}
                                  </span>
                                  <span>
                                    {order.customer.callPreference ||
                                      "Indiferente"}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-semibold">
                                    Cuenta corriente:{" "}
                                  </span>
                                  <span>
                                    {order.customer.accountNumber || "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-semibold">CIF: </span>
                                  <span>{order.customer.cif || "N/A"}</span>
                                </div>
                                <div>
                                  <span className="font-semibold">Notas: </span>
                                  <span>
                                    {order.customer.notes || "Sin notas"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hidden lg:block">
              <div className="bg-[var(--color-primary)] border border-black/10 rounded-xl p-6 sticky top-32 shadow-2xl">
                <h2 className="text-xl font-bold mb-6 text-black">
                  Resumen del mes
                </h2>
                <div className="space-y-1 mb-6">
                  <div className="text-xs text-black/60 uppercase font-bold">
                    Total del mes
                  </div>
                  <div className="text-2xl font-bold text-[var(--color-secondary)]">
                    {totalOrdersAmount.toFixed(2)} €
                  </div>
                  <div className="text-xs text-black/60 mt-1">
                    {formatMonthLabel(expandedMonthKey)}
                  </div>
                </div>
                <div className="text-xs text-black/60 mb-2 uppercase font-bold">
                  Productos vendidos
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {productsSoldSummary.map((item) => (
                    <div
                      key={item.name}
                      className="flex justify-between items-center text-sm bg-black/5 p-2 rounded border border-black/10"
                    >
                      <span className="truncate">{item.name}</span>
                      <span className="ml-4 whitespace-nowrap">
                        {item.quantity} uds
                      </span>
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <>
                    <div className="text-xs text-black/60 mt-6 mb-2 uppercase font-bold">
                      Por comercial
                    </div>
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                      {agentsSummary.map((ag) => (
                        <div
                          key={ag.agent}
                          className="flex justify-between items-center text-sm bg-black/5 p-2 rounded border border-black/10"
                        >
                          <span className="truncate">{ag.agent}</span>
                          <span className="ml-4 whitespace-nowrap text-right">
                            {ag.ordersCount} pedidos · {ag.totalUnits} uds ·{" "}
                            {ag.totalAmount.toFixed(2)} €
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {orderPendingEdit && (
        <EditOrder
          order={orderPendingEdit}
          productsCatalog={productsCatalog}
          getEffectivePrice={getEffectivePrice}
          formatMoney={formatMoney}
          formatDateTime={formatDateTime}
          getOrderPrintId={getOrderPrintId}
          onClose={() => setOrderPendingEdit(null)}
          onSaved={fetchOrders}
        />
      )}

      {isAdmin && orderPendingDelete && (
        <>
          <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            onClick={closeDeleteOrderModal}
          />
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-black/10 bg-[var(--color-primary)] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
                <div className="flex items-center gap-2">
                  <Trash2 size={18} className="text-red-700" />
                  <h3 className="text-black font-extrabold">Eliminar pedido</h3>
                </div>
                <button
                  type="button"
                  onClick={closeDeleteOrderModal}
                  disabled={
                    deletingOrderKey === getOrderKey(orderPendingDelete)
                  }
                  className="h-9 w-9 rounded-full border border-black/10 bg-white/70 text-black/70 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
              <div className="px-5 py-5 space-y-4">
                <div className="text-sm text-black/70">
                  ¿Seguro que quieres eliminar este pedido? Esta acción no se
                  puede deshacer.
                </div>

                <div className="bg-white/60 border border-black/10 rounded-xl p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-xs font-bold text-black/60 uppercase tracking-wider">
                      Nº pedido
                    </span>
                    <span className="font-semibold text-black">
                      {getOrderPrintId(orderPendingDelete)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 mt-2">
                    <span className="text-xs font-bold text-black/60 uppercase tracking-wider">
                      Cliente
                    </span>
                    <span className="font-semibold text-black text-right">
                      {orderPendingDelete.customer?.name || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 mt-2">
                    <span className="text-xs font-bold text-black/60 uppercase tracking-wider">
                      Comercial
                    </span>
                    <span className="font-semibold text-black text-right">
                      {orderPendingDelete.agent || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 mt-2">
                    <span className="text-xs font-bold text-black/60 uppercase tracking-wider">
                      Fecha
                    </span>
                    <span className="font-semibold text-black text-right">
                      {formatDateTime(orderPendingDelete.date)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 mt-2">
                    <span className="text-xs font-bold text-black/60 uppercase tracking-wider">
                      Total
                    </span>
                    <span className="font-semibold text-black text-right">
                      {formatMoney(orderPendingDelete.total)}
                    </span>
                  </div>
                </div>

                {deleteModalError && (
                  <div className="bg-red-600/10 border border-red-600/20 text-red-700 rounded-xl p-3 text-sm">
                    {deleteModalError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeDeleteOrderModal}
                    disabled={
                      deletingOrderKey === getOrderKey(orderPendingDelete)
                    }
                    className="px-4 py-2 rounded-xl border border-black/15 text-black hover:bg-black/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteOrder(orderPendingDelete)}
                    disabled={
                      deletingOrderKey === getOrderKey(orderPendingDelete) ||
                      (!orderPendingDelete.filename &&
                        !orderPendingDelete.agent)
                    }
                    className="px-4 py-2 rounded-xl bg-red-600 text-white hover:brightness-95 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingOrderKey === getOrderKey(orderPendingDelete) ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Eliminando...
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} />
                        Eliminar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default ComercialHistory;
