import { useState, useEffect } from "react";

// ─── tokens PROESA ───────────────────────────────────────────────────────────
const C = {
  navy:       "#1A1A2E",
  red:        "#E63946",
  redHover:   "#CC2F3B",
  redLight:   "rgba(230,57,70,0.10)",
  redGlow:    "rgba(230,57,70,0.10)",
  gray50:     "#F8F9FF",
  gray100:    "#F0F0F0",
  gray400:    "#AAAAAA",
  gray600:    "#666666",
  white:      "#FFFFFF",
};

// ─── estilos inline (mismo sistema del proyecto PROESA) ──────────────────────
const S = {
  page: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: C.gray50,
  },

  // Panel izquierdo ─────────────────────────────────────────────────────────
  brand: {
    width: "44%",
    background: C.navy,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "2.5rem",
    position: "relative",
    overflow: "hidden",
  },
  brandCircle1: {
    position: "absolute",
    bottom: "-80px",
    left: "-80px",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: C.red,
    opacity: 0.08,
    pointerEvents: "none",
  },
  brandCircle2: {
    position: "absolute",
    top: "-60px",
    right: "-60px",
    width: "220px",
    height: "220px",
    borderRadius: "50%",
    background: C.red,
    opacity: 0.06,
    pointerEvents: "none",
  },
  brandLogo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    position: "relative",
    zIndex: 1,
  },
  brandMark: {
    width: "40px",
    height: "40px",
    background: C.red,
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "16px",
    color: C.white,
    flexShrink: 0,
  },
  brandName: {
    fontSize: "17px",
    fontWeight: 600,
    color: C.white,
    letterSpacing: "0.3px",
  },
  brandBody: {
    position: "relative",
    zIndex: 1,
  },
  brandEyebrow: {
    fontSize: "11px",
    fontWeight: 600,
    color: C.red,
    letterSpacing: "2px",
    textTransform: "uppercase",
    marginBottom: "12px",
  },
  brandHeadline: {
    fontSize: "30px",
    fontWeight: 700,
    color: C.white,
    lineHeight: 1.2,
    marginBottom: "16px",
  },
  brandDesc: {
    fontSize: "13.5px",
    color: "rgba(255,255,255,0.50)",
    lineHeight: 1.7,
    maxWidth: "280px",
  },
  brandFooter: {
    position: "relative",
    zIndex: 1,
  },
  statRow: {
    display: "flex",
    gap: "24px",
  },
  stat: {
    borderLeft: `2px solid ${C.red}`,
    paddingLeft: "10px",
  },
  statNum: {
    fontSize: "22px",
    fontWeight: 700,
    color: C.white,
  },
  statLabel: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.40)",
    marginTop: "2px",
  },

  // Panel derecho ─────────────────────────────────────────────────────────
  formPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "2.5rem 2rem",
    background: C.white,
  },
  formInner: {
    width: "100%",
    maxWidth: "340px",
  },
  formTitle: {
    fontSize: "22px",
    fontWeight: 700,
    color: C.navy,
    marginBottom: "4px",
  },
  formSubtitle: {
    fontSize: "13.5px",
    color: C.gray400,
    marginBottom: "1.8rem",
  },

  // Badge período ─────────────────────────────────────────────────────────
  periodBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: C.redLight,
    color: C.red,
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 12px",
    borderRadius: "20px",
    marginBottom: "1.6rem",
  },

  // Campos ────────────────────────────────────────────────────────────────
  field: {
    marginBottom: "1.1rem",
  },
  label: {
    display: "block",
    fontSize: "11.5px",
    fontWeight: 600,
    color: C.gray600,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  inputWrap: {
    position: "relative",
  },
  inputIcon: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "16px",
    color: C.gray400,
    pointerEvents: "none",
    lineHeight: 1,
  },
  input: (focused) => ({
    width: "100%",
    height: "42px",
    padding: "0 40px 0 38px",
    border: `1px solid ${focused ? C.red : "#E0E0E0"}`,
    borderRadius: "8px",
    fontSize: "14px",
    color: C.navy,
    background: focused ? C.white : "#FAFAFA",
    outline: "none",
    boxShadow: focused ? `0 0 0 3px ${C.redGlow}` : "none",
    transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
    boxSizing: "border-box",
  }),
  eyeBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: C.gray400,
    padding: 0,
    display: "flex",
    alignItems: "center",
    fontSize: "16px",
    lineHeight: 1,
  },

  // Error ─────────────────────────────────────────────────────────────────
  errorMsg: {
    display: "flex",
    alignItems: "flex-start",
    gap: "7px",
    background: "#FFF5F5",
    borderLeft: `3px solid ${C.red}`,
    borderRadius: "0 6px 6px 0",
    padding: "10px 12px",
    fontSize: "13px",
    color: "#C0303B",
    marginTop: "12px",
  },

  // Botón submit ──────────────────────────────────────────────────────────
  btnSubmit: (loading) => ({
    width: "100%",
    height: "44px",
    background: loading ? "#B0272F" : C.red,
    color: C.white,
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginTop: "1.6rem",
    letterSpacing: "0.2px",
    transition: "background 0.15s",
    pointerEvents: loading ? "none" : "auto",
  }),

  // Divider ───────────────────────────────────────────────────────────────
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
    marginTop: "1rem",
    lineHeight: 1.5,
  },
  helpLink: {
    color: C.red,
    textDecoration: "none",
    fontWeight: 500,
  },

  // Estado éxito ──────────────────────────────────────────────────────────
  successWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: "0.5rem 0",
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
    fontSize: "28px",
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
    height: "44px",
    background: C.red,
    color: C.white,
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
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

// ─── Spinner SVG ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg
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

  // Fecha dinámica para el badge y los stats
  const ahora  = new Date();
  const MESES  = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const mesStr = MESES[ahora.getMonth()];
  const anio   = ahora.getFullYear();
  const diaStr = `${ahora.getDate()} ${mesStr}`;

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
      // El backend valida en Supabase y devuelve { id, nombre, rol, codigo_empleado }
      // o { error: "Código no registrado" }
      //
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre:          nombre.trim(),
          codigo_empleado: codigo.trim().toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Código no registrado. Consultá con tu supervisor.");
        return;
      }

      // Guardamos el JWT y datos del empleado en localStorage
      localStorage.setItem("token",            data.token);
      localStorage.setItem("empleado_id",      data.empleado.id);
      localStorage.setItem("empleado_nombre",  data.empleado.nombre);
      localStorage.setItem("empleado_rol",     data.empleado.rol);
      localStorage.setItem("empleado_codigo",  data.empleado.codigo_empleado);

      setEmpleado(data.empleado);

      // ─────────────────────────────────────────────────────────────────────
      // MODO DESARROLLO — borrar cuando tengas el backend en Render
      // ─────────────────────────────────────────────────────────────────────
      // const MOCK = {
      //   EMP001:  { id: "1", nombre: "Juan Pérez",   rol: "relevador", codigo_empleado: "EMP001" },
      //   EMP002:  { id: "2", nombre: "María García", rol: "relevador", codigo_empleado: "EMP002" },
      //   ADMIN01: { id: "3", nombre: "Admin PROESA", rol: "admin",     codigo_empleado: "ADMIN01" },
      // };
      // const found = MOCK[codigo.trim().toUpperCase()];
      // if (!found) { setError(`Código "${codigo.toUpperCase()}" no registrado.`); return; }
      // setEmpleado(found);
      // ─────────────────────────────────────────────────────────────────────

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

  // ── RENDER: estado éxito ──────────────────────────────────────────────────
  if (empleado) {
    return (
      <div style={S.page}>
        <BrandPanel mesStr={mesStr} anio={anio} diaStr={diaStr} />
        <div style={S.formPanel}>
          <div style={S.formInner}>
            <div style={S.successWrap} role="status" aria-live="polite">
              <div style={S.successCircle}>✓</div>
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
                ➜ Entrar al sistema
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: formulario ────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <BrandPanel mesStr={mesStr} anio={anio} diaStr={diaStr} />

      <div style={S.formPanel}>
        <div style={S.formInner}>
          <h1 style={S.formTitle}>Iniciar sesión</h1>
          <p  style={S.formSubtitle}>Ingresá tus credenciales para continuar</p>

          {/* Badge período */}
          <div style={S.periodBadge}>
            📅 Período activo: {mesStr} {anio}
          </div>

          {/* Campo nombre */}
          <div style={S.field}>
            <label htmlFor="nombreInput" style={S.label}>Nombre de usuario</label>
            <div style={S.inputWrap}>
              <span style={S.inputIcon}>👤</span>
              <input
                id="nombreInput"
                type="text"
                value={nombre}
                onChange={handleNombreChange}
                onKeyDown={handleNombreKey}
                onFocus={() => setFocusNombre(true)}
                onBlur={() => setFocusNombre(false)}
                placeholder="Ej: Juan Pérez"
                autoComplete="name"
                style={S.input(focusNombre)}
              />
            </div>
          </div>

          {/* Campo código */}
          <div style={S.field}>
            <label htmlFor="codigoInput" style={S.label}>Código de empleado</label>
            <div style={S.inputWrap}>
              <span style={S.inputIcon}>🪪</span>
              <input
                id="codigoInput"
                type={showCodigo ? "text" : "password"}
                value={codigo}
                onChange={handleCodigoChange}
                onKeyDown={handleCodigoKey}
                onFocus={() => setFocusCodigo(true)}
                onBlur={() => setFocusCodigo(false)}
                placeholder="Ej: EMP001"
                autoComplete="current-password"
                style={S.input(focusCodigo)}
              />
              <button
                style={S.eyeBtn}
                type="button"
                onClick={() => setShowCodigo(v => !v)}
                aria-label={showCodigo ? "Ocultar código" : "Mostrar código"}
              >
                {showCodigo ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={S.errorMsg} role="alert" aria-live="assertive">
              <span style={{ flexShrink: 0 }}>⚠</span>
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
            {loading ? <Spinner /> : "➜ Ingresar"}
          </button>

          {/* Divider */}
          <div style={S.dividerWrap}>
            <div style={S.dividerLine} />
            <span style={S.dividerText}>o</span>
            <div style={S.dividerLine} />
          </div>

          <p style={S.helpText}>
            ¿Olvidaste tu código?{" "}
            <a href="mailto:admin@proesa.com" style={S.helpLink}>
              Contactá al administrador
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Panel de marca (reutilizable) ───────────────────────────────────────────
function BrandPanel({ mesStr, anio, diaStr }) {
  return (
    <div style={S.brand} aria-hidden="true">
      <div style={S.brandCircle1} />
      <div style={S.brandCircle2} />

      {/* Logo */}
      <div style={S.brandLogo}>
        <div style={S.brandMark}>RP</div>
        <span style={S.brandName}>PROESA</span>
      </div>

      {/* Texto central */}
      <div style={S.brandBody}>
        <div style={S.brandEyebrow}>Sistema interno</div>
        <div style={S.brandHeadline}>
          Relevamiento<br />
          de <span style={{ color: "#E63946" }}>Precios</span>
        </div>
        <p style={S.brandDesc}>
          Registrá precios de compra, venta y márgenes por producto.
          Comparación automática con la competencia.
        </p>
      </div>

      {/* Stats */}
      <div style={S.brandFooter}>
        <div style={S.statRow}>
          {[
            { num: "3",    label: "Rubros"      },
            { num: "30+",  label: "Categorías"  },
            { num: diaStr, label: "Hoy"         },
          ].map(({ num, label }) => (
            <div key={label} style={S.stat}>
              <div style={S.statNum}>{num}</div>
              <div style={S.statLabel}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}