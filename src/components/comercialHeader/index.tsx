import React, { useState } from "react";
import { Menu, X, LogOut, History, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ComercialHeaderProps {
  onLogout: () => void;
  onOrdersClick: () => void;
  isAdmin?: boolean;
  onMakeOrderClick?: () => void;
  onCreateComercialClick?: () => void;
}

const ComercialHeader: React.FC<ComercialHeaderProps> = ({
  onLogout,
  onOrdersClick,
  isAdmin,
  onMakeOrderClick,
  onCreateComercialClick,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogoClick = () => {
    // If we want to go home, or stay in commercial.
    // Usually logo goes to home, but this is a commercial panel.
    // Let's go to /comercial root (reload or reset) or just do nothing?
    // The main header goes to "/".
    navigate("/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-primary)] text-black border-b border-black/10 h-16 shadow-md">
      <div className="container mx-auto px-4 h-full flex items-center justify-between relative">
        {/* Mobile Menu Button (Left) */}
        <button
          className="md:hidden text-black p-2"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Logo (Center on mobile, Left on Desktop) */}
        <div
          className="cursor-pointer absolute left-1/2 transform -translate-x-1/2 md:static md:transform-none md:flex md:items-center"
          onClick={handleLogoClick}
        >
          <picture>
            <source media="(min-width: 768px)" srcSet="/MAN-BLANCO.png" />
            <img
              src="/MAN-BLANCO.png"
              alt="MΛN POWERS - Comercial"
              className="h-8 md:h-11 invert"
            />
          </picture>
        </div>

        {/* Desktop Actions (Right) */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={onOrdersClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black hover:bg-black/5 transition-all border border-black/15"
          >
            <History size={18} />
            <span>Pedidos Anteriores</span>
          </button>

          {isAdmin && onCreateComercialClick && (
            <button
              onClick={onCreateComercialClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black hover:bg-black/5 transition-all border border-black/15"
            >
              <UserPlus size={18} />
              <span>Crear Comercial</span>
            </button>
          )}

          {isAdmin && onMakeOrderClick && (
            <button
              onClick={onMakeOrderClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-secondary)] text-white hover:brightness-90 transition-all border border-transparent"
            >
              <span>Hacer Pedido</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-secondary)] text-white hover:brightness-90 transition-all border border-transparent"
          >
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>

        {/* Placeholder for alignment on mobile (Right) */}
        <div className="w-10 md:hidden"></div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-[var(--color-primary)]/98 backdrop-blur-md border-b border-black/10 p-4 flex flex-col gap-3 shadow-xl animate-in slide-in-from-top-5">
          <button
            onClick={() => {
              onOrdersClick();
              setIsMenuOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-4 rounded-lg bg-[var(--color-primary)] text-black active:bg-black/5 border border-black/15"
          >
            <History size={20} />
            <span className="font-medium">Pedidos Anteriores</span>
          </button>

          {isAdmin && onCreateComercialClick && (
            <button
              onClick={() => {
                onCreateComercialClick();
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-4 rounded-lg bg-white text-black active:bg-black/5 border border-black/15"
            >
              <UserPlus size={20} />
              <span className="font-medium">Crear Comercial</span>
            </button>
          )}

          {isAdmin && onMakeOrderClick && (
            <button
              onClick={() => {
                onMakeOrderClick();
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-4 rounded-lg bg-[var(--color-secondary)] text-white active:brightness-90 border border-transparent"
            >
              <span className="font-medium">Hacer Pedido</span>
            </button>
          )}

          <button
            onClick={() => {
              onLogout();
              setIsMenuOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-4 rounded-lg bg-[var(--color-secondary)] text-white active:brightness-90 border border-transparent"
          >
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      )}
    </header>
  );
};

export default ComercialHeader;
