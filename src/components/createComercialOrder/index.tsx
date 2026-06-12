import React from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
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

type SelectedProduct = Product & { quantity: number };

interface CreateComercialOrderProps {
  customerData: CustomerData;
  setCustomerData: (next: CustomerData) => void;
  discountPercent: string;
  setDiscountPercent: (next: string) => void;
  getSelectedProducts: () => SelectedProduct[];
  getEffectivePrice: (product: Product) => number;
  calculateTotal: () => number;
  calculateFinalTotal: () => number;
  isDiscountOverMax: () => boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

const CreateComercialOrder: React.FC<CreateComercialOrderProps> = ({
  customerData,
  setCustomerData,
  discountPercent,
  setDiscountPercent,
  getSelectedProducts,
  getEffectivePrice,
  calculateTotal,
  calculateFinalTotal,
  isDiscountOverMax,
  isSubmitting,
  onBack,
  onConfirm,
}) => {
  return (
    <div className="max-w-4xl mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={20} /> Volver al catálogo
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-[var(--color-primary)] border border-black/10 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-6 text-black flex items-center gap-2">
              <span className="text-yellow-500">📝</span> Datos del Cliente
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
                    setCustomerData({ ...customerData, name: e.target.value })
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
                    setCustomerData({ ...customerData, phone: e.target.value })
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
                    setCustomerData({ ...customerData, email: e.target.value })
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
                    setCustomerData({ ...customerData, notes: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[var(--color-primary)] border border-black/10 rounded-xl p-6 shadow-xl sticky top-32">
            <h2 className="text-xl font-bold mb-6 text-black flex items-center gap-2">
              <span className="text-[var(--color-secondary)]">🛒</span> Resumen
              Final
            </h2>

            <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {getSelectedProducts().map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center text-sm bg-black/5 p-3 rounded-lg border border-black/10"
                >
                  <div className="flex-grow">
                    <div className="text-black font-medium">{p.name.es}</div>
                    <div className="text-black/60 text-xs">x{p.quantity}</div>
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
                <span className="text-black/60 text-sm">Descuento (%)</span>
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
              type="button"
              className="w-full mt-6 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-green-900/20 transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !customerData.name ||
                !customerData.phone ||
                !customerData.address ||
                isSubmitting ||
                isDiscountOverMax()
              }
              onClick={onConfirm}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Check size={20} />
              )}
              {isSubmitting ? "ENVIANDO..." : "CONFIRMAR PEDIDO"}
            </button>
            <p className="text-xs text-black/60 text-center mt-4">
              * Todos los campos son obligatorios excepto email, empresa,
              preferencia horaria y notas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateComercialOrder;
