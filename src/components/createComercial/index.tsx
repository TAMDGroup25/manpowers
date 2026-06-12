import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";

interface CreateComercialProps {
  isAdmin: boolean;
  onBack: () => void;
}

const CreateComercial: React.FC<CreateComercialProps> = ({
  isAdmin,
  onBack,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isAgentAdmin, setIsAgentAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setError("");
    setSuccess("");
  }, []);

  const canSubmit = useMemo(() => {
    return Boolean(username.trim() && password && isAdmin && !isSubmitting);
  }, [username, password, isAdmin, isSubmitting]);

  const reset = useCallback(() => {
    setUsername("");
    setPassword("");
    setFullName("");
    setEmail("");
    setIsAgentAdmin(false);
    setShowPassword(false);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isAdmin) {
        setError("No autorizado.");
        setSuccess("");
        return;
      }

      const usernameValue = username.trim();
      const passwordValue = password;
      const fullNameValue = fullName.trim();
      const emailValue = email.trim();

      if (!usernameValue || !passwordValue) {
        setError("Usuario y contraseña son obligatorios.");
        setSuccess("");
        return;
      }

      setIsSubmitting(true);
      setError("");
      setSuccess("");

      try {
        const response = await fetch("/backend/create_comercial.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: usernameValue,
            password: passwordValue,
            full_name: fullNameValue || undefined,
            email: emailValue || undefined,
            is_admin: isAgentAdmin ? 1 : 0,
          }),
        });

        const data = (await response.json().catch(() => null)) as
          | { success: true; message?: string }
          | { success: false; message?: string; error?: string }
          | null;

        if (response.ok && data && "success" in data && data.success) {
          setSuccess(data.message || "Agente comercial creado correctamente.");
          reset();
          return;
        }

        const message =
          (data && "message" in data && data.message) ||
          (data && "error" in data && data.error) ||
          "Error al crear el agente comercial.";
        setError(message);
      } catch (err) {
        console.error("Error creando comercial:", err);
        setError("Error de conexión al crear el agente comercial.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, fullName, isAdmin, isAgentAdmin, password, reset, username],
  );

  return (
    <div className="max-w-xl mx-auto">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-black/15 text-black hover:border-[var(--color-secondary)] hover:text-[var(--color-secondary)] transition-colors mb-6"
      >
        <ArrowLeft size={18} /> Volver
      </button>

      <div className="bg-[var(--color-primary)] border border-black/10 rounded-2xl p-6 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-black tracking-tight">
            Crear Comercial
          </h2>
          <p className="text-sm text-black/60 mt-1">
            Crea un nuevo usuario para el panel comercial.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wider mb-2">
              Usuario *
            </label>
            <input
              type="text"
              className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black placeholder-black/40 focus:outline-none focus:border-[var(--color-secondary)] focus:ring-1 focus:ring-[var(--color-secondary)] transition-all"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="usuario"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wider mb-2">
              Contraseña *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 pr-11 text-black placeholder-black/40 focus:outline-none focus:border-[var(--color-secondary)] focus:ring-1 focus:ring-[var(--color-secondary)] transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-black/40 hover:text-black/70"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wider mb-2">
              Nombre completo (opcional)
            </label>
            <input
              type="text"
              className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black placeholder-black/40 focus:outline-none focus:border-[var(--color-secondary)] focus:ring-1 focus:ring-[var(--color-secondary)] transition-all"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre Apellido"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wider mb-2">
              Email (opcional)
            </label>
            <input
              type="email"
              className="w-full bg-white border border-black/15 rounded-lg px-4 py-3 text-black placeholder-black/40 focus:outline-none focus:border-[var(--color-secondary)] focus:ring-1 focus:ring-[var(--color-secondary)] transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="comercial@empresa.com"
              autoComplete="off"
            />
          </div>

          <label className="flex items-center gap-3 select-none">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-secondary)]"
              checked={isAgentAdmin}
              onChange={(e) => setIsAgentAdmin(e.target.checked)}
            />
            <span className="text-sm text-black/80">Dar permisos de admin</span>
          </label>

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm flex items-center">
              <span className="mr-2">⚠️</span> {error}
            </div>
          )}

          {success && (
            <div className="bg-green-900/20 border border-green-800/60 text-green-200 px-4 py-3 rounded-lg text-sm flex items-center">
              <span className="mr-2">✅</span> {success}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-[var(--color-secondary)] hover:brightness-90 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <UserPlus size={20} />
            )}
            {isSubmitting ? "CREANDO..." : "CREAR COMERCIAL"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateComercial;
