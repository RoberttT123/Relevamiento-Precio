import { useState } from "react";
import logoProesa from "../assets/logo_proesa.png";

// ─── tokens PROESA ───────────────────────────────────────────────────────────
const C = {
  navy:       "#1A1A2E",
  navySoft:   "#23233D",
  red:        "#E63946",
  redHover:   "#CC2F3B",
  redLight:   "rgba(230,57,70,0.10)",
  redGlow:    "rgba(230,57,70,0.16)",
  gray50:     "#F8F9FF",
  gray100:    "#F0F0F0",
  gray400:    "#AAAAAA",
  gray600:    "#666666",
  white:      "#FFFFFF",
};

// ─── estilos inline ───────────────────────────────────────────────────────────
// Layout: fondo navy sólido a pantalla completa, con una tarjeta blanca
// centrada y flotante (con sombra) que contiene el logo y el formulario.
// Mobile-first: la tarjeta ocupa casi todo el ancho en celular y se acota
// a un máximo de 400px en pantallas más anchas.
const S = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: C.navy,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)`,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
  },

  // Formas decorativas sutiles, igual espíritu que el diseño anterior
  bgCircle1: {
    position: "absolute",
    bottom: "-120px",
    left: "-100px",
    width: "320px",
    height: "320px",
    borderRadius: "50%",
    background: C.red,
    opacity: 0.08,
    pointerEvents: "none",
  },
  bgCircle2: {
    position: "absolute",
    top: "-100px",
    right: "-90px",
    width: "260px",
    height: "260px",
    borderRadius: "50%",
    background: C.red,
    opacity: 0.07,
    pointerEvents: "none",
  },

  // ── Columna central: logo + tarjeta ───────────────────────────────────────
  centerCol: {
    width: "100%",
    maxWidth: "380px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },

  // ── Logo, ahora dentro de la propia tarjeta blanca ────────────────────────
  logoWrap: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "18px",
  },
  logoImg: {
    height: "128px",
    width: "auto",
    display: "block",
  },

  // ── Tarjeta blanca con el formulario ──────────────────────────────────────
  card: {
    width: "100%",
    background: C.white,
    borderRadius: "20px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.30)",
    padding: "32px 26px 28px",
    boxSizing: "border-box",
  },

  formTitle: {
    fontSize: "21px",
    fontWeight: 700,
    color: C.navy,
    marginBottom: "4px",
    textAlign: "center",
  },
  formSubtitle: {
    fontSize: "13px",
    color: C.gray400,
    marginBottom: "1.4rem",
    textAlign: "center",
  },

  periodBadge: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    background: C.redLight,
    color: C.red,
    fontSize: "11px",
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: "20px",
    marginBottom: "1.5rem",
    margin: "0 auto 1.5rem",
    width: "fit-content",
  },

  // ── Campos ────────────────────────────────────────────────────────────────
  field: {
    marginBottom: "1rem",
  },
  label: {
    display: "block",
    fontSize: "11.5px",
    fontWeight: 600,
    color: C.gray600,
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    marginBottom: "7px",
  },
  inputWrap: {
    position: "relative",
  },
  inputIconWrap: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    color: C.gray400,
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
  },
  input: (focused) => ({
    width: "100%",
    height: "52px",
    padding: "0 44px 0 42px",
    border: `1.5px solid ${focused ? C.red : "#E0E0E0"}`,
    borderRadius: "10px",
    fontSize: "16px", // 16px fijo: evita el zoom automático de iOS en inputs
    color: C.navy,
    background: focused ? C.white : "#FAFAFA",
    outline: "none",
    boxShadow: focused ? `0 0 0 4px ${C.redGlow}` : "none",
    transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
    boxSizing: "border-box",
    WebkitAppearance: "none",
  }),
  eyeBtn: {
    position: "absolute",
    right: "6px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: C.gray400,
    padding: "10px",
    display: "flex",
    alignItems: "center",
    WebkitTapHighlightColor: "transparent",
  },

  errorMsg: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    background: "#FFF5F5",
    borderLeft: `3px solid ${C.red}`,
    borderRadius: "0 8px 8px 0",
    padding: "11px 13px",
    fontSize: "13px",
    color: "#C0303B",
    marginTop: "10px",
    lineHeight: 1.4,
  },

  // ── Botón ─────────────────────────────────────────────────────────────────
  btnSubmit: (loading) => ({
    width: "100%",
    height: "52px",
    background: loading ? "#B0272F" : C.red,
    color: C.white,
    border: "none",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginTop: "1.4rem",
    letterSpacing: "0.2px",
    transition: "background 0.15s",
    pointerEvents: loading ? "none" : "auto",
    WebkitTapHighlightColor: "transparent",
  }),

  dividerWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: "1.4rem 0 0",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    background: C.gray100,
  },
  dividerText: {
    fontSize: "11px",
    color: "#BBBBBB",
  },
  helpText: {
    fontSize: "12.5px",
    color: "#AAAAAA",
    textAlign: "center",
    marginTop: "1.1rem",
    lineHeight: 1.5,
  },
  helpLink: {
    color: C.red,
    textDecoration: "none",
    fontWeight: 500,
  },

  // ── Estado éxito ──────────────────────────────────────────────────────────
  successWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  successCircle: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: C.redLight,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "16px",
    color: C.red,
  },
  successName: {
    fontSize: "18px",
    fontWeight: 700,
    color: C.navy,
    marginBottom: "4px",
  },
  successRole: {
    fontSize: "13px",
    color: C.gray400,
    marginBottom: "1.6rem",
  },
  btnEnter: {
    width: "100%",
    height: "52px",
    background: C.red,
    color: C.white,
    border: "none",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "background 0.15s",
    textDecoration: "none",
  },
};

const RESPONSIVE_CSS = `
  @media (prefers-reduced-motion: reduce) {
    .login-spinner { animation: none !important; }
  }
`;

// ─── Iconos SVG (un solo trazo, consistentes con la paleta) ──────────────────
const Icon = {
  Usuario: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Credencial: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="8" cy="11.2" r="1.7" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M5.6 15.2c0-1.3 1.1-2 2.4-2s2.4 0.7 2.4 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M14 9.8h5M14 12.2h5M14 14.6h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  OjoAbierto: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M2 12c2.2-4.2 6-6.5 10-6.5s7.8 2.3 10 6.5c-2.2 4.2-6 6.5-10 6.5S4.2 16.2 2 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  ),
  OjoCerrado: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M3 12c1-1.9 2.4-3.4 4-4.4M21 12c-1 1.9-2.4 3.4-4 4.4M9.6 6.4C10.3 6.1 11.1 6 12 6c4 0 7.8 2.3 10 6.5-0.5 1-1.2 1.9-1.9 2.7M14.4 17.6c-0.7 0.3-1.5 0.4-2.4 0.4-4 0-7.8-2.3-10-6.5 0.5-1 1.2-1.9 1.9-2.7"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Calendario: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M3 9.5h18M7.5 3v4M16.5 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Flecha: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: (p) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M5 13l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Alerta: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M12 3.5 2 20.5h20L12 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="12" cy="17" r="1" fill="currentColor"/>
    </svg>
  ),
};

// ─── Spinner SVG ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg
      className="login-spinner"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      style={{ animation: "spin 0.7s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="9" cy="9" r="7"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="2"
      />
      <path
        d="M9 2 A7 7 0 0 1 16 9"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function Login({ onLoginSuccess }) {
  // onLoginSuccess(empleado) → { id, nombre, rol, codigo_empleado }
  // Lo llama el padre (App.jsx) para guardar el estado de sesión global

  const [nombre,       setNombre]       = useState("");
  const [codigo,       setCodigo]       = useState("");
  const [showCodigo,   setShowCodigo]   = useState(false);
  const [focusNombre,  setFocusNombre]  = useState(false);
  const [focusCodigo,  setFocusCodigo]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [empleado,     setEmpleado]     = useState(null); // estado de éxito

  // Fecha dinámica para el badge
  const ahora  = new Date();
  const MESES  = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const mesStr = MESES[ahora.getMonth()];
  const anio   = ahora.getFullYear();

  // Limpiar error al tipear
  const handleNombreChange = (e) => { setNombre(e.target.value); setError(""); };
  const handleCodigoChange = (e) => { setCodigo(e.target.value); setError(""); };

  // Enter avanza entre campos
  const handleNombreKey = (e) => {
    if (e.key === "Enter") document.getElementById("codigoInput").focus();
  };
  const handleCodigoKey = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  // ── Normaliza la URL base del backend, sacando cualquier barra final ──────
  // Evita el bug de "//api/auth/login" si VITE_API_URL quedó con "/" al final.
  function apiUrl(path) {
    const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
    return `${base}${path}`;
  }

  async function handleLogin() {
    if (!nombre.trim()) {
      setError("Ingresá tu nombre de usuario.");
      return;
    }
    if (!codigo.trim()) {
      setError("Ingresá tu código de empleado.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // ── LLAMADA REAL AL BACKEND EN RENDER ────────────────────────────────
      // El backend valida en Supabase y devuelve { token, empleado: {...} }
      // o lanza HTTPException con { detail: "mensaje" }.
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre:          nombre.trim(),
          codigo_empleado: codigo.trim().toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok || data.detail) {
        setError(data.detail || "Código no registrado. Consultá con tu supervisor.");
        return;
      }

      // Guardamos el JWT y datos del empleado en localStorage
      localStorage.setItem("token",            data.token);
      localStorage.setItem("empleado_id",      data.empleado.id);
      localStorage.setItem("empleado_nombre",  data.empleado.nombre);
      localStorage.setItem("empleado_rol",     data.empleado.rol);
      localStorage.setItem("empleado_codigo",  data.empleado.codigo_empleado);

      setEmpleado(data.empleado);

    } catch (err) {
      setError("Error de conexión. Verificá tu red e intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function handleEnter() {
    // Notifica al componente padre (App.jsx) para redirigir a /productos
    if (onLoginSuccess) onLoginSuccess(empleado);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{RESPONSIVE_CSS}</style>
      <div style={S.bgCircle1} />
      <div style={S.bgCircle2} />

      <div style={S.centerCol}>

        {/* Tarjeta */}
        <div style={S.card}>

          {/* Logo, dentro de la tarjeta */}
          <div style={S.logoWrap}>
            <img src={logoProesa} alt="PROESA" style={S.logoImg} />
          </div>

          {empleado ? (
            // ── Estado éxito ──────────────────────────────────────────────
            <div style={S.successWrap} role="status" aria-live="polite">
              <div style={S.successCircle}>
                <Icon.Check />
              </div>
              <div style={S.successName}>{empleado.nombre}</div>
              <div style={S.successRole}>
                {empleado.rol.charAt(0).toUpperCase() + empleado.rol.slice(1)} · {mesStr} {anio}
              </div>
              <button
                style={S.btnEnter}
                onClick={handleEnter}
                onMouseEnter={e => (e.target.style.background = C.redHover)}
                onMouseLeave={e => (e.target.style.background = C.red)}
              >
                Entrar al sistema <Icon.Flecha />
              </button>
            </div>
          ) : (
            // ── Formulario ────────────────────────────────────────────────
            <>
              <h1 style={S.formTitle}>Iniciar sesión</h1>
              <p  style={S.formSubtitle}>Ingresá tus credenciales para continuar</p>

              <div style={S.periodBadge}>
                <Icon.Calendario /> Período activo: {mesStr} {anio}
              </div>

              {/* Campo nombre */}
              <div style={S.field}>
                <label htmlFor="nombreInput" style={S.label}>Nombre de usuario</label>
                <div style={S.inputWrap}>
                  <span style={S.inputIconWrap}><Icon.Usuario /></span>
                  <input
                    id="nombreInput"
                    type="text"
                    value={nombre}
                    onChange={handleNombreChange}
                    onKeyDown={handleNombreKey}
                    onFocus={() => setFocusNombre(true)}
                    onBlur={() => setFocusNombre(false)}
                    placeholder="Ej: Aquiles Castro"
                    autoComplete="name"
                    style={S.input(focusNombre)}
                  />
                </div>
              </div>

              {/* Campo código */}
              <div style={S.field}>
                <label htmlFor="codigoInput" style={S.label}>Código de empleado</label>
                <div style={S.inputWrap}>
                  <span style={S.inputIconWrap}><Icon.Credencial /></span>
                  <input
                    id="codigoInput"
                    type={showCodigo ? "text" : "password"}
                    value={codigo}
                    onChange={handleCodigoChange}
                    onKeyDown={handleCodigoKey}
                    onFocus={() => setFocusCodigo(true)}
                    onBlur={() => setFocusCodigo(false)}
                    placeholder="Ej: EMPO1122"
                    autoComplete="current-password"
                    style={S.input(focusCodigo)}
                  />
                  <button
                    style={S.eyeBtn}
                    type="button"
                    onClick={() => setShowCodigo(v => !v)}
                    aria-label={showCodigo ? "Ocultar código" : "Mostrar código"}
                  >
                    {showCodigo ? <Icon.OjoCerrado /> : <Icon.OjoAbierto />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={S.errorMsg} role="alert" aria-live="assertive">
                  <span style={{ flexShrink: 0, marginTop: "1px" }}><Icon.Alerta /></span>
                  <span>{error}</span>
                </div>
              )}

              {/* Botón */}
              <button
                style={S.btnSubmit(loading)}
                onClick={handleLogin}
                disabled={loading}
                type="button"
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = C.redHover; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = C.red; }}
              >
                {loading ? <Spinner /> : <>Ingresar <Icon.Flecha /></>}
              </button>

              {/* Divider */}
              <div style={S.dividerWrap}>
                <div style={S.dividerLine} />
                <span style={S.dividerText}>o</span>
                <div style={S.dividerLine} />
              </div>

              <p style={S.helpText}>
                ¿Olvidaste tu código?{" "}
                <a href="israeltinini2@gmail.com" style={S.helpLink}>
                  Contactá al administrador
                </a>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}