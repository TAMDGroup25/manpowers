import React from "react";
import { Eye, EyeOff } from "lucide-react";

interface ComercialLoginProps {
  username: string;
  password: string;
  showPassword: boolean;
  error: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
}

const ComercialLogin: React.FC<ComercialLoginProps> = ({
  username,
  password,
  showPassword,
  error,
  onUsernameChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit,
}) => {
  return (
    <div className="w-full max-w-md bg-[var(--color-primary)] border border-black/10 rounded-2xl p-8 shadow-2xl shadow-[var(--color-secondary)]/10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 text-black">Acceso Comercial</h1>
        <p className="text-black/60 text-sm">
          Introduce tus credenciales para gestionar pedidos
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wider mb-2">
            Usuario
          </label>
          <input
            type="text"
            className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black placeholder-black/40 focus:outline-none focus:border-[var(--color-secondary)] focus:ring-1 focus:ring-[var(--color-secondary)] transition-all"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
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
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-black/40 hover:text-black/70"
              onClick={onTogglePassword}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
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
  );
};

export default ComercialLogin;
