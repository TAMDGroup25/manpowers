import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Header from "../components/header/Header";
import Footer from "../components/footer/Footer";
import productsService, { type Product } from "../services/productsService";
import emailjs from "@emailjs/browser";
import {
  Minus,
  Plus,
  ShoppingCart,
  ChevronUp,
  ChevronDown,
  Trash2,
  History,
  ArrowLeft,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Printer,
} from "lucide-react";
import ComercialHeader from "../components/comercialHeader";

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

interface MonthSummaryPrint {
  monthKey: string;
  monthLabel: string;
  generatedAt: string;
  orders: Order[];
  ordersCount: number;
  totalAmount: number;
  hiddenCount: number;
}

const resolveAssetUrl = (url?: string) => {
  if (!url) return url;
  if (/^(https?:)?\/\//.test(url)) return url;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("/")) {
    return `${import.meta.env.BASE_URL}${url.slice(1)}`;
  }
  return url;
};

const buildImageCandidates = (url?: string) => {
  const raw = url ?? "";
  const candidates = [
    resolveAssetUrl(raw),
    resolveAssetUrl(encodeURI(raw)),
    resolveAssetUrl(raw.toLowerCase()),
    resolveAssetUrl(encodeURI(raw.toLowerCase())),
  ].filter((v): v is string => typeof v === "string" && v.length > 0);
  return Array.from(new Set(candidates));
};

const Comercial: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");
  const [error, setError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<{ [key: number]: number }>({});
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [view, setView] = useState<
    "products" | "orders" | "checkout" | "confirmed"
  >("products");
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [deletingOrderKey, setDeletingOrderKey] = useState<string | null>(null);
  const [orderPendingDelete, setOrderPendingDelete] = useState<Order | null>(
    null,
  );
  const [deleteModalError, setDeleteModalError] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<{
    [key: string]: boolean;
  }>({});
  const [expandedMonthKey, setExpandedMonthKey] = useState(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
  });
  const [showManpowers, setShowManpowers] = useState(true);
  const [showTamd, setShowTamd] = useState(true);
  const [showOrdersSummaryMobile, setShowOrdersSummaryMobile] = useState(false);
  const [showAgentsSummary, setShowAgentsSummary] = useState(true);
  const [adminOrdersSearch, setAdminOrdersSearch] = useState("");
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
  const [monthSummaryToPrint, setMonthSummaryToPrint] =
    useState<MonthSummaryPrint | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const originalTitleRef = useRef<string | null>(null);

  const ALL_MONTH_KEY = "__ALL__";

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
  }, []);

  const getOrderKey = useCallback((order: Order) => {
    if (order.filename) return order.filename;
    return [
      order.date || "",
      order.agent || "",
      order.customer?.email || "",
      order.customer?.phone || "",
      String(order.total ?? ""),
    ].join("|");
  }, []);

  const getMonthKeyFromDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "Sin fecha";
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${month}`;
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
    [currentMonthKey, ALL_MONTH_KEY],
  );

  const ordersByMonth = useMemo(() => {
    const map = new Map<string, Order[]>();
    orders.forEach((o) => {
      const key = getMonthKeyFromDate(o.date);
      const prev = map.get(key) || [];
      prev.push(o);
      map.set(key, prev);
    });
    return map;
  }, [orders, getMonthKeyFromDate]);

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

  const monthSelectorKeys = useMemo(() => {
    return [ALL_MONTH_KEY, ...monthKeys];
  }, [monthKeys, ALL_MONTH_KEY]);

  useEffect(() => {
    if (view !== "orders" || !isLoggedIn) return;
    setExpandedMonthKey(currentMonthKey);
    setExpandedOrders({});
  }, [view, isLoggedIn, currentMonthKey]);

  useEffect(() => {
    if (expandedMonthKey === ALL_MONTH_KEY) return;
    if (expandedMonthKey === "Sin fecha") return;
    if (expandedMonthKey === currentMonthKey) return;
    if (monthKeys.includes(expandedMonthKey)) return;
    setExpandedMonthKey(currentMonthKey);
    setExpandedOrders({});
  }, [expandedMonthKey, monthKeys, currentMonthKey, ALL_MONTH_KEY]);

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
  }, [ordersByMonth, expandedMonthKey, allOrdersSorted, ALL_MONTH_KEY]);

  const normalizeSearchText = useCallback((input: string) => {
    return input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }, []);

  const formatMoney = useCallback((value: number) => {
    if (!Number.isFinite(value)) return "N/A";
    return `${value.toFixed(2)} €`;
  }, []);

  const setPrintDocumentTitle = useCallback((nextTitle: string) => {
    if (typeof document === "undefined") return;
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title;
    }
    document.title = nextTitle;
  }, []);

  const restoreDocumentTitle = useCallback(() => {
    if (typeof document === "undefined") return;
    if (originalTitleRef.current === null) return;
    document.title = originalTitleRef.current;
    originalTitleRef.current = null;
  }, []);

  const formatDateTime = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${d.toLocaleDateString("es-ES")} · ${d.toLocaleTimeString("es-ES")}`;
  }, []);

  const formatDateOnly = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("es-ES");
  }, []);

  const computeOrderBreakdown = useCallback((order: Order) => {
    const subtotal =
      typeof order.subtotal === "number"
        ? order.subtotal
        : order.products?.reduce((acc, p) => acc + p.price * p.quantity, 0) ||
          0;
    const discountPercentValue =
      typeof order.discount_percent === "number" ? order.discount_percent : 0;
    const discountAmountValue =
      typeof order.discount_amount === "number"
        ? order.discount_amount
        : (subtotal * discountPercentValue) / 100;
    const taxableBase = subtotal - discountAmountValue;
    const total = typeof order.total === "number" ? order.total : taxableBase;
    return {
      subtotal,
      discountPercentValue,
      discountAmountValue,
      taxableBase,
      total,
    };
  }, []);

  const getOrderPrintId = useCallback((order: Order) => {
    if (order.filename) return order.filename;
    const d = new Date(order.date);
    if (Number.isNaN(d.getTime())) return "pedido";
    const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
      2,
      "0",
    )}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(
      2,
      "0",
    )}${String(d.getMinutes()).padStart(2, "0")}`;
    const agentPart = (order.agent || "comercial")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "");
    return `${datePart}-${agentPart}`.replace(/-+$/g, "");
  }, []);

  const handlePrintOrder = useCallback(
    (order: Order) => {
      setPrintDocumentTitle("MANPOWERS");
      setMonthSummaryToPrint(null);
      setOrderToPrint(order);
      setIsPrinting(true);
    },
    [setPrintDocumentTitle],
  );

  useEffect(() => {
    if (!isPrinting) return;
    if (!orderToPrint && !monthSummaryToPrint) return;
    const onAfterPrint = () => {
      setIsPrinting(false);
      setOrderToPrint(null);
      setMonthSummaryToPrint(null);
      restoreDocumentTitle();
    };
    window.addEventListener("afterprint", onAfterPrint);
    const t = window.setTimeout(() => {
      window.print();
    }, 50);
    return () => {
      window.removeEventListener("afterprint", onAfterPrint);
      window.clearTimeout(t);
      restoreDocumentTitle();
    };
  }, [isPrinting, monthSummaryToPrint, orderToPrint, restoreDocumentTitle]);

  const printStyles = useMemo(
    () => `
@media screen {
  .print-only {
    display: none !important;
  }
}

@media print {
  @page {
    size: A4;
    margin: 14mm;
  }

  html,
  body {
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
    background: #ffffff !important;
    color: #111111 !important;
  }

  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  .print-page {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    color: #111111;
  }

  .mono {
    font-variant-numeric: tabular-nums;
  }

  .print-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(17, 17, 17, 0.12);
    margin-bottom: 14px;
  }

  .print-brand {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }

  .print-logo-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-logo {
    height: 25px;
    width: auto;
    display: block;
  }

  .print-subtitle {
    margin-top: 2px;
    font-size: 12px;
    color: rgba(17, 17, 17, 0.68);
  }

  .print-meta {
    min-width: 240px;
    display: grid;
    gap: 6px;
    font-size: 12px;
  }

  .print-meta-row {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 10px;
  }

  .print-meta-label {
    color: rgba(17, 17, 17, 0.68);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 10px;
    font-weight: 700;
  }

  .print-meta-value {
    font-weight: 700;
  }

  .print-grid {
    display: grid;
    grid-template-columns: 1.35fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }

  .print-card {
    border: 1px solid rgba(17, 17, 17, 0.12);
    border-radius: 14px;
    padding: 12px 12px;
    background: #ffffff;
  }

  .print-card-title {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(17, 17, 17, 0.68);
    margin-bottom: 10px;
  }

  .print-kv {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 10px;
    font-size: 12px;
    line-height: 1.35;
  }

  .print-kv-label {
    color: rgba(17, 17, 17, 0.68);
    font-weight: 600;
  }

  .print-kv-value {
    font-weight: 600;
  }

  .print-kv-value.mono {
    font-variant-numeric: tabular-nums;
  }

  .print-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .print-table thead {
    display: table-header-group;
  }

  .print-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .print-table th {
    text-align: left;
    padding: 8px 8px;
    background: rgba(17, 17, 17, 0.04);
    border-bottom: 1px solid rgba(17, 17, 17, 0.12);
    color: rgba(17, 17, 17, 0.72);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 10px;
    font-weight: 800;
  }

  .print-table td {
    padding: 8px 8px;
    border-bottom: 1px solid rgba(17, 17, 17, 0.08);
    vertical-align: top;
  }

  .print-right {
    text-align: right;
  }

  .print-muted {
    color: rgba(17, 17, 17, 0.68);
  }

  .print-total {
    font-weight: 900;
    font-size: 14px;
  }

  .print-footer {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(17, 17, 17, 0.12);
    font-size: 11px;
    color: rgba(17, 17, 17, 0.62);
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }
}
`,
    [],
  );

  const filteredOrders = useMemo(() => {
    if (!isAdmin) return activeMonthOrders;
    const q = normalizeSearchText(adminOrdersSearch);
    if (!q) return activeMonthOrders;
    return activeMonthOrders.filter((o) => {
      const customer = o.customer || ({} as CustomerData);
      const haystack = [
        getOrderPrintId(o),
        customer.name,
        o.agent,
        customer.company,
        customer.cif,
        customer.email,
        customer.address,
      ]
        .filter(Boolean)
        .join(" ");
      return normalizeSearchText(haystack).includes(q);
    });
  }, [
    activeMonthOrders,
    adminOrdersSearch,
    getOrderPrintId,
    isAdmin,
    normalizeSearchText,
  ]);

  const monthSummaries = useMemo(() => {
    const result = new Map<string, { count: number; total: number }>();

    const computeOrderTotal = (o: Order) => {
      if (typeof o.total === "number") return o.total;
      const subtotal =
        o.products?.reduce((acc, p) => acc + p.price * p.quantity, 0) || 0;
      const discountAmount =
        typeof o.discount_amount === "number"
          ? o.discount_amount
          : ((typeof o.discount_percent === "number" ? o.discount_percent : 0) /
              100) *
            subtotal;
      const taxableBase = subtotal - discountAmount;
      return taxableBase;
    };

    monthKeys.forEach((key) => {
      const list = ordersByMonth.get(key) || [];
      const total = list.reduce((sum, o) => sum + computeOrderTotal(o), 0);
      result.set(key, { count: list.length, total });
    });

    return result;
  }, [ordersByMonth, monthKeys]);

  const allOrdersSummary = useMemo(() => {
    const total = orders.reduce((sum, o) => {
      if (typeof o.total === "number") return sum + o.total;
      const subtotal =
        o.products?.reduce((acc, p) => acc + p.price * p.quantity, 0) || 0;
      const discountAmount =
        typeof o.discount_amount === "number"
          ? o.discount_amount
          : ((typeof o.discount_percent === "number" ? o.discount_percent : 0) /
              100) *
            subtotal;
      const taxableBase = subtotal - discountAmount;
      return sum + taxableBase;
    }, 0);
    return { count: orders.length, total };
  }, [orders]);

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
      const taxableBase = subtotal - discountAmount;
      return sum + taxableBase;
    }, 0);
  }, [filteredOrders]);

  const handlePrintMonthSummary = useCallback(() => {
    setPrintDocumentTitle("MANPOWERS");
    const nowIso = new Date().toISOString();
    const generatedAt = formatDateTime(nowIso);
    const monthLabel = formatMonthLabel(expandedMonthKey);

    setOrderToPrint(null);
    setMonthSummaryToPrint({
      monthKey: expandedMonthKey,
      monthLabel,
      generatedAt,
      orders: filteredOrders,
      ordersCount: filteredOrders.length,
      totalAmount: totalOrdersAmount,
      hiddenCount: 0,
    });
    setIsPrinting(true);
  }, [
    expandedMonthKey,
    filteredOrders,
    formatDateTime,
    formatMonthLabel,
    setPrintDocumentTitle,
    totalOrdersAmount,
  ]);

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
          map.set(key, { name: key, quantity: addQty, amount: addAmt });
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
        const taxableBase = subtotal - discountAmount;
        orderAmount = taxableBase;
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

  useEffect(() => {
    // Check if previously logged in (optional persistence)
    // For now, we stick to session state
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      Promise.all([
        productsService.getProducts(),
        productsService.getTamdProducts(),
      ]).then(([manpowers, tamd]) => {
        const mp = manpowers.map((p) => ({
          ...p,
          source: "manpowers" as const,
        }));
        setProducts([...mp, ...tamd]);
      });
    }
  }, [isLoggedIn]);

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
    [getOrderKey, isAdmin],
  );

  useEffect(() => {
    if (view === "orders" && isLoggedIn) {
      fetchOrders();
    }
  }, [view, isLoggedIn, fetchOrders]);

  useEffect(() => {
    if (!isLoggedIn) return;
    window.scrollTo(0, 0);
  }, [view, isLoggedIn]);

  const commercialProducts = useMemo(() => {
    const result: Product[] = [];
    const existingIds = new Set(products.map((p) => p.id));
    const seenNames = new Set<string>();

    products.forEach((product) => {
      if (
        product.id === 3 &&
        product.pricesBySize &&
        Object.keys(product.pricesBySize).length > 0
      ) {
        const sizeKeys = Object.keys(product.pricesBySize);
        sizeKeys.forEach((sizeKey, index) => {
          const raw = product.pricesBySize?.[sizeKey];
          let priceNum = product.price;
          if (typeof raw === "string") {
            const num = parseFloat(raw.replace(",", "."));
            if (!Number.isNaN(num)) {
              priceNum = num;
            }
          }

          let newId = product.id * 100 + (index + 1);
          while (existingIds.has(newId)) {
            newId += 1;
          }
          existingIds.add(newId);

          const newNameEs = `${product.name.es} (${sizeKey})`;

          if (!seenNames.has(newNameEs)) {
            seenNames.add(newNameEs);
            result.push({
              ...product,
              id: newId,
              name: {
                ...product.name,
                es: newNameEs,
              },
              price: priceNum,
            });
          }
        });
      } else {
        if (!seenNames.has(product.name.es)) {
          seenNames.add(product.name.es);
          result.push(product);
        }
      }
    });
    return result;
  }, [products]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("/backend/comercial_login.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await response.json()) as
        | { ok: true; username: string; is_admin: boolean }
        | { ok: false; error?: string };

      if (response.ok && data.ok) {
        setIsLoggedIn(true);
        const admin = Boolean(data.is_admin);
        setIsAdmin(admin);
        setView(admin ? "orders" : "products");
        return;
      }

      setError(
        data.ok
          ? "Usuario o contraseña incorrectos"
          : data.error || "Usuario o contraseña incorrectos",
      );
      return;
    } catch (err) {
      console.error("Error al conectar con el servidor:", err);
      setError("No se pudo conectar con el servidor");
      return;
    }

    setError("Usuario o contraseña incorrectos");
  };

  const handleQuantityChange = (id: number, qty: number) => {
    if (qty < 0) return;
    setQuantities((prev) => ({ ...prev, [id]: qty }));
  };

  const getEffectivePrice = (product: Product) => {
    let price = product.price;
    if (product.id === 10006) {
      price = price * 0.65; // 35% discount
    }
    return price;
  };

  const calculateTotal = () => {
    return commercialProducts.reduce((acc, product) => {
      const qty = quantities[product.id] || 0;
      const price = getEffectivePrice(product);
      return acc + price * qty;
    }, 0);
  };

  const getDiscountPercentNumber = () => {
    const raw = discountPercent.replace(",", ".");
    const value = parseFloat(raw);
    if (Number.isNaN(value) || value < 0) return 0;
    if (value > 30) return 30;
    return value;
  };

  const isDiscountOverMax = () => {
    const raw = discountPercent.replace(",", ".");
    const value = parseFloat(raw);
    if (Number.isNaN(value)) return false;
    return value > 30;
  };

  const getTotals = () => {
    const subtotal = calculateTotal();
    const percent = getDiscountPercentNumber();
    const discountAmount = (subtotal * percent) / 100;
    const baseAfterDiscount = subtotal - discountAmount;
    const taxableBase = baseAfterDiscount > 0 ? baseAfterDiscount : 0;
    const finalTotal = taxableBase;
    return {
      subtotal,
      percent,
      discountAmount,
      taxableBase,
      finalTotal,
    };
  };

  const calculateFinalTotal = () => {
    const { finalTotal } = getTotals();
    return finalTotal;
  };

  const totalItems = Object.values(quantities).reduce((acc, q) => acc + q, 0);

  const getSelectedProducts = () => {
    return commercialProducts
      .filter((p) => (quantities[p.id] || 0) > 0)
      .map((p) => ({
        ...p,
        quantity: quantities[p.id],
      }));
  };

  // Group products by category for better organization
  const groupProductsByCategory = (list: Product[]) => {
    return list.reduce(
      (acc, product) => {
        const category =
          typeof product.category === "string"
            ? product.category
            : product.category.es; // Default to ES for commercial view

        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(product);
        return acc;
      },
      {} as { [key: string]: Product[] },
    );
  };

  const manpowersList = commercialProducts.filter((p) => p.source !== "tamd");
  const tamdList = commercialProducts.filter((p) => p.source === "tamd");

  const manpowersGrouped = groupProductsByCategory(manpowersList);
  const tamdGrouped = groupProductsByCategory(tamdList);

  const handleConfirmOrder = async () => {
    if (!customerData.name || !customerData.phone || !customerData.address)
      return;

    setIsSubmitting(true);

    const selectedProducts = getSelectedProducts().map((p) => {
      const unitPrice = getEffectivePrice(p);
      return {
        id: p.id,
        name: p.name.es,
        quantity: p.quantity,
        price: unitPrice,
        total: unitPrice * p.quantity,
      };
    });

    const {
      subtotal,
      percent: discountPercentNumber,
      discountAmount,
      taxableBase,
      finalTotal,
    } = getTotals();

    const orderData = {
      customer: customerData,
      products: selectedProducts,
      subtotal,
      discount_percent: discountPercentNumber,
      discount_amount: discountAmount,
      total: finalTotal,
      date: new Date().toISOString(),
      agent: username,
    };

    try {
      const response = await fetch("/backend/save_order.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        try {
          const productsHtml = selectedProducts
            .map(
              (p) => `
                <tr>
                    <td>${p.name}</td>
                    <td style="text-align: center;">${p.quantity}</td>
                    <td style="text-align: right;">${p.price.toFixed(2)} €</td>
                    <td style="text-align: right;">${p.total.toFixed(2)} €</td>
                </tr>
            `,
            )
            .join("");

          const templateParams = {
            agent: username,
            date: new Date().toLocaleString(),
            customer_name: customerData.name,
            customer_company: customerData.company || "N/A",
            customer_cif: customerData.cif || "N/A",
            customer_email: customerData.email || "N/A",
            customer_phone: customerData.phone,
            customer_address: customerData.address,
            call_preference: customerData.callPreference || "Indiferente",
            customer_notes: customerData.notes || "Sin notas",
            customer_account_number: customerData.accountNumber || "N/A",
            products_list: productsHtml,
            subtotal_order: subtotal.toFixed(2),
            discount_percent: discountPercentNumber.toFixed(2),
            discount_amount: discountAmount.toFixed(2),
            taxable_base: taxableBase.toFixed(2),
            vat_amount: "0.00",
            total_order: finalTotal.toFixed(2),
          };

          await emailjs.send(
            "service_bpquuvf",
            "template_mvqiigl",
            templateParams,
            "VbS91pBRVJyfs4wc9",
          );
        } catch (emailError) {
          console.error("Error sending email:", emailError);
          alert(
            "Pedido guardado en servidor, pero hubo un error al enviar el correo.",
          );
        }

        setQuantities({});
        setCustomerData({
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
        setDiscountPercent("");
        setView("confirmed");
      } else {
        const errorData = await response.json();
        alert(
          "Error al guardar el pedido: " +
            (errorData.error || "Error desconocido"),
        );
      }
    } catch (error) {
      console.error("Error submitting order:", error);
      alert("Error de conexión al intentar guardar el pedido.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--color-primary)] text-black font-sans">
        <Header />
        <main className="flex-grow pt-32 pb-10 px-4 flex items-center justify-center">
          <div className="w-full max-w-md bg-[var(--color-primary)] border border-black/10 rounded-2xl p-8 shadow-2xl shadow-[var(--color-secondary)]/10">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2 text-black">
                Acceso Comercial
              </h1>
              <p className="text-black/60 text-sm">
                Introduce tus credenciales para gestionar pedidos
              </p>
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wider mb-2">
                  Usuario
                </label>
                <input
                  type="text"
                  className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black placeholder-black/40 focus:outline-none focus:border-[var(--color-secondary)] focus:ring-1 focus:ring-[var(--color-secondary)] transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Usuario asignado"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wider mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 pr-11 text-black placeholder-black/40 focus:outline-none focus:border-[var(--color-secondary)] focus:ring-1 focus:ring-[var(--color-secondary)] transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-black/40 hover:text-black/70"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm flex items-center">
                  <span className="mr-2">⚠️</span> {error}
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-[var(--color-secondary)] hover:brightness-90 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-[1.02] shadow-lg"
              >
                ACCEDER AL PANEL
              </button>
            </form>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const renderProductGroup = (category: string, items: Product[]) => (
    <div key={category} className="space-y-4">
      <h2 className="text-xl font-bold text-[var(--color-secondary)] uppercase tracking-wider border-b border-black/10 pb-2">
        {category}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((product) => (
          <div
            key={product.id}
            className={`
              relative bg-[var(--color-primary)] border rounded-xl overflow-hidden transition-all duration-300
              ${
                (quantities[product.id] || 0) > 0
                  ? "border-[var(--color-secondary)] shadow-lg shadow-[var(--color-secondary)]/20"
                  : "border-black/10 hover:border-black/30"
              }
            `}
          >
            <div className="flex p-4 gap-4">
              <div className="w-20 h-20 bg-black/5 rounded-lg flex-shrink-0 overflow-hidden">
                <img
                  src={buildImageCandidates(product.image)[0]}
                  alt={product.name.es}
                  className="w-full h-full object-cover"
                  data-image-candidates={buildImageCandidates(
                    product.image,
                  ).join("|")}
                  data-image-candidate-idx="0"
                  onError={(e) => {
                    const img = e.currentTarget;
                    const serialized = img.dataset.imageCandidates || "";
                    const list = serialized ? serialized.split("|") : [];
                    const idx = Number(img.dataset.imageCandidateIdx || "0");
                    const next = list[idx + 1];
                    if (typeof next === "string" && next.length > 0) {
                      img.dataset.imageCandidateIdx = String(idx + 1);
                      img.src = next;
                      return;
                    }
                    img.style.display = "none";
                  }}
                />
              </div>
              <div className="flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-black leading-tight mb-1">
                    {product.name.es}
                  </h3>
                </div>
                <div className="flex justify-between items-end mt-2">
                  {product.id === 10006 ? (
                    <div className="flex flex-col items-end">
                      <span className="text-sm line-through text-black/40">
                        {product.price.toFixed(2)} €
                      </span>
                      <span className="text-lg font-bold text-red-600">
                        {(product.price * 0.65).toFixed(2)} €
                      </span>
                    </div>
                  ) : (
                    <span className="text-lg font-bold text-[var(--color-secondary)]">
                      {product.price.toFixed(2)} €
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Controls Footer */}
            <div className="bg-black/5 p-3 border-t border-black/10 flex items-center justify-between">
              <span className="text-xs text-black/60">
                {(quantities[product.id] || 0) > 0 ? "Cantidad:" : "Añadir:"}
              </span>
              <div className="flex items-center gap-3">
                <button
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border ${
                    (quantities[product.id] || 0) > 0
                      ? "border-[var(--color-secondary)] bg-[var(--color-primary)] text-[var(--color-secondary)] hover:bg-[var(--color-primary)]/80"
                      : "border-[var(--color-secondary)]/40 bg-[var(--color-primary)] text-[var(--color-secondary)]/40 cursor-not-allowed"
                  }`}
                  onClick={() =>
                    handleQuantityChange(
                      product.id,
                      (quantities[product.id] || 0) - 1,
                    )
                  }
                  disabled={(quantities[product.id] || 0) === 0}
                >
                  <Minus size={14} />
                </button>

                <input
                  type="number"
                  min="0"
                  className={`w-12 bg-transparent text-center font-bold focus:outline-none focus:ring-1 focus:ring-[var(--color-secondary)]/50 rounded appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                    (quantities[product.id] || 0) > 0
                      ? "text-black"
                      : "text-black/40"
                  }`}
                  value={quantities[product.id] || 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    handleQuantityChange(product.id, isNaN(val) ? 0 : val);
                  }}
                  onFocus={(e) => e.target.select()}
                />

                <button
                  className="w-8 h-8 rounded-full bg-[var(--color-secondary)] hover:brightness-95 text-white flex items-center justify-center transition-colors shadow-lg"
                  onClick={() =>
                    handleQuantityChange(
                      product.id,
                      (quantities[product.id] || 0) + 1,
                    )
                  }
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <style>{printStyles}</style>
      <div className="print-only">
        {monthSummaryToPrint ? (
          <div className="print-page">
            <div className="print-header">
              <div>
                <div className="print-logo-wrap">
                  <img
                    className="print-logo"
                    src={resolveAssetUrl("/MANPOWERS.png")}
                    alt="MANPOWERS"
                  />
                </div>
                <div className="print-subtitle">Resumen mensual de pedidos</div>
              </div>
              <div className="print-meta">
                <div className="print-meta-row">
                  <div className="print-meta-label">Mes</div>
                  <div className="print-meta-value">
                    {monthSummaryToPrint.monthLabel}
                  </div>
                </div>
                <div className="print-meta-row">
                  <div className="print-meta-label">Pedidos</div>
                  <div className="print-meta-value">
                    {monthSummaryToPrint.ordersCount}
                  </div>
                </div>
                <div className="print-meta-row">
                  <div className="print-meta-label">Total</div>
                  <div className="print-meta-value mono print-right">
                    {formatMoney(monthSummaryToPrint.totalAmount)}
                  </div>
                </div>
              </div>
            </div>

            <div className="print-card">
              <div className="print-card-title">Listado</div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th style={{ width: 94 }}>Fecha</th>
                    <th>Cliente</th>
                    <th style={{ width: 140 }}>Comercial</th>
                    <th className="print-right" style={{ width: 90 }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthSummaryToPrint.orders.length > 0 ? (
                    monthSummaryToPrint.orders.map((o) => {
                      const breakdown = computeOrderBreakdown(o);
                      const customer = o.customer || ({} as CustomerData);
                      return (
                        <tr key={getOrderKey(o)}>
                          <td className="mono">{formatDateOnly(o.date)}</td>
                          <td>
                            <div>{customer.name || "N/A"}</div>
                            {customer.company && (
                              <div className="print-muted">
                                {customer.company}
                              </div>
                            )}
                          </td>
                          <td>{o.agent || "N/A"}</td>
                          <td className="print-right mono">
                            {formatMoney(breakdown.total)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="print-muted">
                        No hay pedidos para este mes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="print-footer">
              <div>manpowers.es</div>
              <div className="mono">{monthSummaryToPrint.generatedAt}</div>
            </div>
          </div>
        ) : orderToPrint ? (
          (() => {
            const breakdown = computeOrderBreakdown(orderToPrint);
            const orderId = getOrderPrintId(orderToPrint);
            const dateLabel = formatDateTime(orderToPrint.date);
            const customer = orderToPrint.customer || ({} as CustomerData);
            return (
              <div className="print-page">
                <div className="print-header">
                  <div>
                    <div className="print-logo-wrap">
                      <img
                        className="print-logo"
                        src={resolveAssetUrl("/MANPOWERS.png")}
                        alt="MANPOWERS"
                      />
                    </div>
                    <div className="print-subtitle">
                      Detalle de pedido comercial
                    </div>
                  </div>
                  <div className="print-meta">
                    <div className="print-meta-row">
                      <div className="print-meta-label">Pedido</div>
                      <div className="print-meta-value">{orderId}</div>
                    </div>
                    <div className="print-meta-row">
                      <div className="print-meta-label">Fecha</div>
                      <div className="print-meta-value">{dateLabel}</div>
                    </div>
                    <div className="print-meta-row">
                      <div className="print-meta-label">Comercial</div>
                      <div className="print-meta-value">
                        {orderToPrint.agent || "N/A"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="print-grid">
                  <div className="print-card">
                    <div className="print-card-title">Cliente</div>
                    <div className="print-kv">
                      <div className="print-kv-label">Nombre</div>
                      <div className="print-kv-value">
                        {customer.name || "N/A"}
                      </div>
                      <div className="print-kv-label">Empresa</div>
                      <div className="print-kv-value">
                        {customer.company || "N/A"}
                      </div>
                      <div className="print-kv-label">CIF</div>
                      <div className="print-kv-value">
                        {customer.cif || "N/A"}
                      </div>
                      <div className="print-kv-label">Email</div>
                      <div className="print-kv-value">
                        {customer.email || "N/A"}
                      </div>
                      <div className="print-kv-label">Teléfono</div>
                      <div className="print-kv-value">
                        {customer.phone || "N/A"}
                      </div>
                      <div className="print-kv-label">Dirección</div>
                      <div className="print-kv-value">
                        {customer.address || "N/A"}
                      </div>
                      <div className="print-kv-label">Preferencia</div>
                      <div className="print-kv-value">
                        {customer.callPreference || "Indiferente"}
                      </div>
                      <div className="print-kv-label">Cuenta</div>
                      <div className="print-kv-value">
                        {customer.accountNumber || "N/A"}
                      </div>
                    </div>
                  </div>

                  <div className="print-card">
                    <div className="print-card-title">Totales</div>
                    <div className="print-kv">
                      <div className="print-kv-label">Subtotal</div>
                      <div className="print-kv-value mono print-right">
                        {formatMoney(breakdown.subtotal)}
                      </div>
                      <div className="print-kv-label">Descuento</div>
                      <div className="print-kv-value mono print-right">
                        {Number.isFinite(breakdown.discountPercentValue) &&
                        breakdown.discountPercentValue > 0
                          ? `${breakdown.discountPercentValue.toFixed(2)}% (${formatMoney(
                              breakdown.discountAmountValue,
                            )})`
                          : "—"}
                      </div>
                      <div className="print-kv-label">Base imponible</div>
                      <div className="print-kv-value mono print-right">
                        {formatMoney(breakdown.taxableBase)}
                      </div>
                      <div className="print-kv-label">Total</div>
                      <div className="print-kv-value mono print-right print-total">
                        {formatMoney(breakdown.total)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="print-card">
                  <div className="print-card-title">Productos</div>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className="print-right">Cant.</th>
                        <th className="print-right">Precio</th>
                        <th className="print-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderToPrint.products.map((p, idx) => (
                        <tr key={`${p.id}-${idx}`}>
                          <td>
                            <div>{p.name}</div>
                            <div className="print-muted">ID: {p.id}</div>
                          </td>
                          <td className="print-right mono">{p.quantity}</td>
                          <td className="print-right mono">
                            {formatMoney(p.price)}
                          </td>
                          <td className="print-right mono">
                            {formatMoney(p.price * p.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(customer.notes || "").trim() && (
                  <div className="print-card" style={{ marginTop: 12 }}>
                    <div className="print-card-title">Notas</div>
                    <div
                      style={{
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.35,
                      }}
                    >
                      {customer.notes}
                    </div>
                  </div>
                )}

                <div className="print-footer">
                  <div>manpowers.es</div>
                  <div className="mono">
                    Generado el {formatDateTime(new Date().toISOString())}
                  </div>
                </div>
              </div>
            );
          })()
        ) : null}
      </div>

      <div className="no-print flex flex-col min-h-screen bg-[var(--color-primary)] text-black font-sans selection:bg-[var(--color-secondary)]/30">
        <ComercialHeader
          onLogout={() => {
            setIsLoggedIn(false);
            setIsAdmin(false);
            setView("products");
          }}
          onOrdersClick={() => setView("orders")}
          isAdmin={isAdmin}
          onMakeOrderClick={() => setView("products")}
        />
        <main className="flex-grow pt-28 pb-32 px-4 container mx-auto max-w-7xl">
          {view === "orders" ? (
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
                          : `Imprimir resumen · ${formatMonthLabel(
                              expandedMonthKey,
                            )} (1 página A4)`
                      }
                    >
                      <Printer size={18} />
                      <span className="truncate max-w-[72vw] md:max-w-none">
                        Imprimir resumen · {formatMonthLabel(expandedMonthKey)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("products")}
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
                          {agentsTotals.orders} pedidos · {agentsTotals.units}{" "}
                          uds · {agentsTotals.amount.toFixed(2)} €
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
                        : monthSummaries.get(monthKey) || {
                            count: 0,
                            total: 0,
                          };
                    const selected = monthKey === expandedMonthKey;
                    return (
                      <button
                        key={monthKey}
                        type="button"
                        onClick={() => {
                          setExpandedMonthKey(monthKey);
                          setExpandedOrders({});
                        }}
                        title={`${summary.count} pedidos · ${summary.total.toFixed(
                          2,
                        )} €`}
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

              <div className="w-full max-w-4xl lg:hidden mb-4">
                <div className="bg-[var(--color-primary)] border border-black/10 rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-black/60 uppercase font-bold">
                        Total del mes
                      </div>
                      <div className="text-xl font-bold text-[var(--color-secondary)]">
                        {totalOrdersAmount.toFixed(2)} €
                      </div>
                      <div className="text-xs text-black/60 mt-1">
                        {formatMonthLabel(expandedMonthKey)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOrdersSummaryMobile((v) => !v)}
                      className="px-3 py-2 rounded-lg border border-black/15 text-black hover:bg-black/5 transition-colors text-sm"
                    >
                      {showOrdersSummaryMobile ? "Ocultar" : "Ver detalles"}
                    </button>
                  </div>
                  {showOrdersSummaryMobile && (
                    <div className="mt-3 border-t border-black/10 pt-3">
                      <div className="text-xs text-black/60 mb-2 uppercase font-bold">
                        Productos vendidos
                      </div>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
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
                        <div className="mt-4">
                          <div className="text-xs text-black/60 mb-2 uppercase font-bold">
                            Por comercial
                          </div>
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                            {agentsSummary.map((ag) => (
                              <div
                                key={ag.agent}
                                className="flex justify-between items-center text-sm bg-black/5 p-2 rounded border border-black/10"
                              >
                                <span className="truncate">{ag.agent}</span>
                                <span className="ml-4 whitespace-nowrap text-right">
                                  {ag.ordersCount} pedidos · {ag.totalUnits} uds
                                  · {ag.totalAmount.toFixed(2)} €
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isLoadingOrders ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2
                    className="animate-spin text-[var(--color-secondary)] mb-4"
                    size={48}
                  />
                  <p className="text-gray-400">Cargando pedidos...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-20 bg-[var(--color-primary)] rounded-2xl w-full max-w-2xl border border-black/10">
                  <div className="text-black/40 mb-4 flex justify-center">
                    <History size={64} />
                  </div>
                  <h3 className="text-xl font-bold text-black mb-2">
                    No hay pedidos registrados
                  </h3>
                  <p className="text-black/60 mb-8">
                    Aún no has realizado ningún pedido con este usuario.
                  </p>
                  <button
                    onClick={() => setView("products")}
                    className="px-8 py-3 bg-[var(--color-secondary)] text-white font-bold rounded-xl hover:brightness-90 transition-all shadow-lg"
                  >
                    REALIZAR PEDIDO
                  </button>
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
                          const taxableBase = subtotal - discountAmountValue;
                          const isExpanded = !!expandedOrders[orderKey];
                          const d = new Date(order.date);
                          const dateStr = Number.isNaN(d.getTime())
                            ? order.date
                            : `${d.toLocaleDateString("es-ES")} · ${d.toLocaleTimeString(
                                "es-ES",
                              )}`;

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
                                      Descuento:{" "}
                                      {discountPercentValue.toFixed(0)}%{" "}
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
                                  onClick={() => handlePrintOrder(order)}
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
                                        <span className="font-semibold">
                                          Email:{" "}
                                        </span>
                                        <span>
                                          {order.customer.email || "N/A"}
                                        </span>
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
                                          {order.customer.accountNumber ||
                                            "N/A"}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="font-semibold">
                                          CIF:{" "}
                                        </span>
                                        <span>
                                          {order.customer.cif || "N/A"}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="font-semibold">
                                          Subtotal:{" "}
                                        </span>
                                        <span>{subtotal.toFixed(2)} €</span>
                                      </div>
                                      <div>
                                        <span className="font-semibold">
                                          Descuento aplicado:{" "}
                                        </span>
                                        <span>
                                          {discountPercentValue.toFixed(2)}% (
                                          {discountAmountValue.toFixed(2)} €)
                                        </span>
                                      </div>
                                      <div>
                                        <span className="font-semibold">
                                          Base imponible:{" "}
                                        </span>
                                        <span>{taxableBase.toFixed(2)} €</span>
                                      </div>
                                      <div>
                                        <span className="font-semibold">
                                          Total final:{" "}
                                        </span>
                                        <span>{order.total.toFixed(2)} €</span>
                                      </div>
                                      {order.filename && (
                                        <div>
                                          <span className="font-semibold">
                                            Archivo asociado:{" "}
                                          </span>
                                          <span>{order.filename}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {order.customer.notes && (
                                    <div className="mt-3">
                                      <div className="font-semibold mb-1">
                                        Notas:
                                      </div>
                                      <div className="whitespace-pre-wrap">
                                        {order.customer.notes}
                                      </div>
                                    </div>
                                  )}
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
                                  {ag.ordersCount} pedidos · {ag.totalUnits} uds
                                  · {ag.totalAmount.toFixed(2)} €
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
          ) : view === "checkout" ? (
            <div className="max-w-4xl mx-auto">
              <button
                onClick={() => setView("products")}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
              >
                <ArrowLeft size={20} /> Volver al catálogo
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Formulario */}
                <div className="space-y-6">
                  <div className="bg-[var(--color-primary)] border border-black/10 rounded-xl p-6 shadow-xl">
                    <h2 className="text-xl font-bold mb-6 text-black flex items-center gap-2">
                      <span className="text-yellow-500">📝</span> Datos del
                      Cliente
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-black/70 mb-1">
                          Nombre Completo
                        </label>
                        <input
                          type="text"
                          className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                          placeholder="Ej: Juan Pérez"
                          value={customerData.name}
                          onChange={(e) =>
                            setCustomerData({
                              ...customerData,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black/70 mb-1">
                          Empresa / Comercio (Opcional)
                        </label>
                        <input
                          type="text"
                          className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                          placeholder="Ej: Gimnasio Hércules"
                          value={customerData.company}
                          onChange={(e) =>
                            setCustomerData({
                              ...customerData,
                              company: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black/70 mb-1">
                          CIF (Opcional)
                        </label>
                        <input
                          type="text"
                          className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors uppercase"
                          placeholder="Ej: B12345678"
                          value={customerData.cif || ""}
                          onChange={(e) =>
                            setCustomerData({
                              ...customerData,
                              cif: e.target.value.toUpperCase(),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black/70 mb-1">
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                          placeholder="Ej: 600 000 000"
                          value={customerData.phone}
                          onChange={(e) =>
                            setCustomerData({
                              ...customerData,
                              phone: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black/70 mb-1">
                          Número de cuenta corriente (Opcional)
                        </label>
                        <input
                          type="text"
                          className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors uppercase"
                          placeholder="ES00 0000 0000 0000 0000 0000"
                          value={customerData.accountNumber}
                          onChange={(e) =>
                            setCustomerData({
                              ...customerData,
                              accountNumber: e.target.value.toUpperCase(),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black/70 mb-1">
                          Preferencia Hora de Llamada (Opcional)
                        </label>
                        <input
                          type="text"
                          className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                          placeholder="Ej: Por la mañana, 10:00 - 14:00"
                          value={customerData.callPreference}
                          onChange={(e) =>
                            setCustomerData({
                              ...customerData,
                              callPreference: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black/70 mb-1">
                          Email (Opcional)
                        </label>
                        <input
                          type="email"
                          className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors"
                          placeholder="cliente@email.com"
                          value={customerData.email}
                          onChange={(e) =>
                            setCustomerData({
                              ...customerData,
                              email: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black/70 mb-1">
                          Dirección de Envío
                        </label>
                        <textarea
                          className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors resize-none h-24"
                          placeholder="Calle, Número, Ciudad, CP..."
                          value={customerData.address}
                          onChange={(e) =>
                            setCustomerData({
                              ...customerData,
                              address: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black/70 mb-1">
                          Notas Adicionales
                        </label>
                        <textarea
                          className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black focus:outline-none focus:border-[var(--color-secondary)] transition-colors resize-none h-20"
                          placeholder="Instrucciones especiales..."
                          value={customerData.notes}
                          onChange={(e) =>
                            setCustomerData({
                              ...customerData,
                              notes: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen Final */}
                <div className="space-y-6">
                  <div className="bg-[var(--color-primary)] border border-black/10 rounded-xl p-6 shadow-xl sticky top-32">
                    <h2 className="text-xl font-bold mb-6 text-black flex items-center gap-2">
                      <span className="text-[var(--color-secondary)]">🛒</span>{" "}
                      Resumen Final
                    </h2>

                    <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                      {getSelectedProducts().map((p) => (
                        <div
                          key={p.id}
                          className="flex justify-between items-center text-sm bg-black/5 p-3 rounded-lg border border-black/10"
                        >
                          <div className="flex-grow">
                            <div className="text-black font-medium">
                              {p.name.es}
                            </div>
                            <div className="text-black/60 text-xs">
                              x{p.quantity}
                            </div>
                          </div>
                          <div className="text-[var(--color-secondary)] font-bold whitespace-nowrap">
                            {(getEffectivePrice(p) * p.quantity).toFixed(2)} €
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-gray-200 pt-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-black/60">Subtotal</span>
                        <span className="text-black">
                          {calculateTotal().toFixed(2)} €
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-black/60 text-sm">
                          Descuento (%)
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          step="1"
                          className={`w-28 bg-white rounded-lg px-3 py-2 text-right text-black focus:outline-none text-sm appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                            isDiscountOverMax()
                              ? "border border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                              : "border border-black/15 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                          }`}
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(e.target.value)}
                        />
                      </div>
                      {isDiscountOverMax() && (
                        <div className="text-xs text-red-600 text-right">
                          No se puede aplicar un descuento superior a 30%
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xl font-bold">
                        <span className="text-black">Total a Pagar</span>
                        <span className="text-[var(--color-secondary)]">
                          {calculateFinalTotal().toFixed(2)} €
                        </span>
                      </div>
                    </div>

                    <button
                      className="w-full mt-6 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-green-900/20 transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={
                        !customerData.name ||
                        !customerData.phone ||
                        !customerData.address ||
                        isSubmitting ||
                        isDiscountOverMax()
                      }
                      onClick={handleConfirmOrder}
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <Check size={20} />
                      )}
                      {isSubmitting ? "ENVIANDO..." : "CONFIRMAR PEDIDO"}
                    </button>
                    <p className="text-xs text-black/60 text-center mt-4">
                      * Todos los campos son obligatorios excepto email,
                      empresa, preferencia horaria y notas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : view === "confirmed" ? (
            <div className="max-w-xl mx-auto flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
                <Check className="text-green-600" size={32} />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-black mb-2 text-center">
                Pedido confirmado
              </h2>
              <p className="text-black/70 text-center mb-8 max-w-md">
                Hemos registrado tu pedido correctamente. También se ha enviado
                un correo con el detalle completo.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                <button
                  type="button"
                  onClick={() => setView("orders")}
                  className="flex-1 sm:flex-none px-6 py-3 rounded-xl border border-black/15 text-black hover:bg-black/5 transition-colors font-medium"
                >
                  Ver pedidos
                </button>
                <button
                  type="button"
                  onClick={() => setView("products")}
                  className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-[var(--color-secondary)] text-white hover:brightness-90 transition-colors font-bold"
                >
                  Pedir más
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-black flex items-center gap-2">
                    Panel Comercial
                  </h1>
                  <p className="text-black/60 text-sm mt-1">
                    Selecciona los productos para el pedido
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Products List */}
                <div className="lg:col-span-2 space-y-12">
                  {/* MANPOWERS Section */}
                  <div>
                    <button
                      onClick={() => setShowManpowers(!showManpowers)}
                      className="w-full flex items-center text-start justify-between text-3xl font-black text-black mb-6 border-b-2 border-black pb-2 hover:text-[var(--color-secondary)] transition-colors group"
                    >
                      <span>Productos MANPOWERS</span>
                      {showManpowers ? (
                        <ChevronUp
                          size={32}
                          className="transform transition-transform group-hover:scale-110"
                        />
                      ) : (
                        <ChevronDown
                          size={32}
                          className="transform transition-transform group-hover:scale-110"
                        />
                      )}
                    </button>
                    {showManpowers && (
                      <div className="space-y-8 animate-fade-in">
                        {Object.entries(manpowersGrouped).map(
                          ([category, items]) =>
                            renderProductGroup(category, items),
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <button
                      onClick={() => setShowTamd(!showTamd)}
                      className="w-full flex items-center text-start justify-between text-3xl font-black text-black mb-6 border-b-2 border-black pb-2 hover:text-[var(--color-secondary)] transition-colors group"
                    >
                      <span>Productos TAMD Cosmetics</span>
                      {showTamd ? (
                        <ChevronUp
                          size={32}
                          className="transform transition-transform group-hover:scale-110"
                        />
                      ) : (
                        <ChevronDown
                          size={32}
                          className="transform transition-transform group-hover:scale-110"
                        />
                      )}
                    </button>
                    {showTamd && (
                      <div className="space-y-8 animate-fade-in">
                        {Object.entries(tamdGrouped).map(([category, items]) =>
                          renderProductGroup(category, items),
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Desktop Sidebar Summary */}
                <div className="hidden lg:block lg:col-span-1">
                  <div className="bg-[var(--color-primary)] border border-black/10 rounded-xl p-6 sticky top-32 shadow-2xl">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <ShoppingCart className="text-[var(--color-secondary)]" />{" "}
                      Resumen del Pedido
                    </h2>

                    <div className="space-y-3 mb-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                      {getSelectedProducts().length > 0 ? (
                        getSelectedProducts().map((p) => (
                          <div
                            key={p.id}
                            className="flex justify-between items-start text-sm bg-black/5 p-3 rounded-lg border border-black/10"
                          >
                            <div className="flex-grow">
                              <div className="text-black font-medium">
                                {p.name.es}
                              </div>
                              <div className="text-black/60 text-xs">
                                x{p.quantity} unidad
                                {p.quantity > 1 ? "es" : ""}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[var(--color-secondary)] font-bold">
                                {(getEffectivePrice(p) * p.quantity).toFixed(2)}{" "}
                                €
                              </span>
                              <button
                                onClick={() => handleQuantityChange(p.id, 0)}
                                className="text-gray-600 hover:text-red-400"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 text-black/50 border-2 border-dashed border-black/20 rounded-xl">
                          <ShoppingCart
                            size={32}
                            className="mx-auto mb-2 opacity-50"
                          />
                          <p>No hay productos seleccionados</p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-200 pt-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-black/60">Total Productos</span>
                        <span className="text-black font-bold">
                          {totalItems}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xl">
                        <span className="text-black font-bold">Total</span>
                        <span className="text-[var(--color-secondary)] font-bold">
                          {calculateFinalTotal().toFixed(2)} €
                        </span>
                      </div>
                      <button
                        className="w-full bg-[var(--color-secondary)] hover:brightness-90 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transform active:scale-95"
                        disabled={calculateTotal() === 0}
                        onClick={() => setView("checkout")}
                      >
                        SIGUIENTE
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Mobile Sticky Footer Summary */}
        {view === "products" && (
          <>
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
              {/* Expanded Summary Drawer */}
              {showOrderSummary && (
                <div className="absolute bottom-full left-0 right-0 bg-white border-t border-gray-800 rounded-t-2xl shadow-2xl p-4 max-h-[70vh] overflow-y-auto animate-slide-up">
                  <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b border-black/10">
                    <h3 className="font-bold text-black">Detalle del Pedido</h3>
                    <button
                      onClick={() => setShowOrderSummary(false)}
                      className="p-2 bg-white border border-black rounded-full"
                    >
                      <ChevronDown size={20} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {getSelectedProducts().length > 0 ? (
                      getSelectedProducts().map((p) => (
                        <div
                          key={p.id}
                          className="flex justify-between items-center text-sm bg-white p-3 rounded-lg"
                        >
                          <div className="flex-grow pr-4">
                            <div className="text-black font-medium">
                              {p.name.es}
                            </div>
                            <div className="text-gray-500 text-xs">
                              x{p.quantity}
                            </div>
                          </div>
                          <div className="text-[var(--color-secondary)] font-bold whitespace-nowrap">
                            {(getEffectivePrice(p) * p.quantity).toFixed(2)} €
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-500 py-4">
                        Carrito vacío
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Collapsed Bar */}
              <div className="bg-white backdrop-blur-md border-t border-white/10 p-4 pb-safe shadow-2xl shadow-black/40">
                <div className="flex gap-4 items-center">
                  <button
                    onClick={() => setShowOrderSummary(!showOrderSummary)}
                    className="flex-1 bg-white text-black p-3 rounded-xl flex items-center justify-between px-4 transition-colors border border-white/10 hover:border-[var(--color-secondary)]/60"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-xs text-black flex items-center gap-1">
                        {totalItems} items{" "}
                        <ChevronUp
                          size={12}
                          className={`text-[var(--color-secondary)] transition-transform ${showOrderSummary ? "rotate-180" : ""}`}
                        />
                      </span>
                      <span className="font-bold text-lg text-[var(--color-secondary)]">
                        {calculateFinalTotal().toFixed(2)} €
                      </span>
                    </div>
                  </button>

                  <button
                    className="flex-[1.5] bg-[var(--color-secondary)] hover:brightness-90 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-[var(--color-secondary)]/20 disabled:opacity-50 disabled:grayscale transition-all"
                    disabled={calculateTotal() === 0}
                    onClick={() => setView("checkout")}
                  >
                    SIGUIENTE
                  </button>
                </div>
              </div>
            </div>

            {/* Overlay when drawer is open */}
            {showOrderSummary && (
              <div
                className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
                onClick={() => setShowOrderSummary(false)}
              />
            )}
          </>
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
                    <h3 className="text-black font-extrabold">
                      Eliminar pedido
                    </h3>
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

        <Footer />
      </div>
    </>
  );
};

export default Comercial;
