import type React from "react";
import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, Celular, Fondo, Marca, Titulo } from "./comun";

/** 1 · Arranque: la promesa en grande. */
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const numero = Math.min(99, Math.floor(interpolate(frame, [0, 40], [1, 24], { extrapolateRight: "clamp" })));
  return (
    <Fondo>
      <div style={{ position: "absolute", left: 84, top: 140 }}>
        <Marca />
      </div>
      <Titulo top={290} lineas={["Turnos", "online", "para tu", "barbería"]} acento={3} />
      <div
        style={{
          position: "absolute",
          left: 84,
          right: 84,
          bottom: 260,
          background: C.display,
          borderRadius: 28,
          padding: "40px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: spring({ frame: frame - 18, fps, config: { damping: 200 } }),
        }}
      >
        <span style={{ color: "#CDBFAE", fontSize: 44, fontWeight: 700 }}>Sacá número</span>
        <span style={{ color: C.led, fontSize: 170, fontWeight: 900, fontStretch: "62%", textShadow: "0 0 30px rgba(255,43,28,.55)", lineHeight: 1 }}>
          {String(numero).padStart(2, "0")}
        </span>
      </div>
      <div style={{ position: "absolute", left: 84, bottom: 150, fontSize: 46, fontWeight: 700, color: C.gastada }}>Sin fila. Sin cuenta. Sin seña.</div>
    </Fondo>
  );
};

/** 2 · Tu link: la página de la barbería. */
export const Pagina: React.FC = () => (
  <Fondo>
    <Titulo lineas={["Tu link,", "tu turnero"]} sub="Lo compartís en Instagram y WhatsApp. Tus clientes sacan turno solos." />
    <Celular src="cap/01-pagina.png" top={720} />
  </Fondo>
);

/** 3 · Eligen el horario. */
export const Horarios: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Fondo oscuro>
      <Titulo oscuro lineas={["Eligen", "el horario"]} sub="Ven todos los libres del día, con cada barbero." />
      <Celular src="cap/02-horarios.png" top={640}>
        <div
          style={{
            position: "absolute",
            left: 36,
            top: 640,
            width: 568,
            height: 210,
            borderRadius: 16,
            border: `6px solid ${C.rollo}`,
            opacity: interpolate(frame, [30, 40, 70, 80], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        />
      </Celular>
    </Fondo>
  );
};

/** 4 · Nombre, teléfono y listo. */
export const Datos: React.FC = () => (
  <Fondo>
    <Titulo lineas={["Nombre,", "teléfono", "y listo"]} acento={2} sub="Sin cuenta, sin seña. Confirmado al instante." />
    <Celular src="cap/03-datos.png" top={860} />
  </Fondo>
);

/** 5 · Ticket + recordatorio por mail. */
export const Ticket: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const aviso = spring({ frame: frame - 34, fps, config: { damping: 16 } });
  return (
    <Fondo oscuro>
      <Titulo oscuro lineas={["Ticket y", "recordatorio"]} sub="Les llega por mail el día anterior. Menos clientes que faltan." />
      <Celular src="cap/04-ticket.png" top={700} />
      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          top: 640,
          background: C.papel,
          borderRadius: 30,
          padding: "28px 34px",
          boxShadow: "0 24px 60px rgba(0,0,0,.28)",
          display: "flex",
          gap: 24,
          alignItems: "center",
          opacity: aviso,
          translate: `0px ${interpolate(aviso, [0, 1], [-60, 0])}px`,
        }}
      >
        <div style={{ width: 84, height: 84, borderRadius: 22, background: C.tinta, color: C.rollo, display: "grid", placeItems: "center", fontWeight: 900, fontStretch: "62%", fontSize: 44, flex: "none" }}>
          Nº
        </div>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, color: C.tinta }}>Mañana a las 15:00</div>
          <div style={{ fontSize: 30, fontWeight: 500, color: C.gastada }}>Tu turno en Inspirationmen · Con Alexis</div>
        </div>
      </div>
    </Fondo>
  );
};

/** 6 · El dueño: agenda en el celu. */
export const Agenda: React.FC = () => (
  <Fondo oscuro>
    <Titulo oscuro lineas={["Tu agenda", "en el celu"]} sub="Marcás quién vino y suma solo a la caja del día." />
    <Celular src="cap/08-grilla.png" top={760} desde={0} hasta={0.25} />
  </Fondo>
);

const PREMIOS = ["Corte gratis", "20% off", "Cera de regalo", "10% off", "Barba gratis", "5% off"];
const GAJOS = [C.rollo, C.tinta, C.papel, C.led];

/** 7 · Premios: la ruleta que los hace volver. */
export const Ruleta: React.FC = () => {
  const frame = useCurrentFrame();
  const giro = interpolate(frame, [10, 80], [0, 1440 + 30], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.15, 0.75, 0.1, 1) });
  const n = PREMIOS.length;
  const paso = 360 / n;
  const R = 100;
  return (
    <Fondo>
      <Titulo lineas={["Premios", "que los traen", "de vuelta"]} acento={2} sub="Tarjeta de cortes y ruleta de premios." />
      <div style={{ position: "absolute", left: 140, top: 900, width: 800, height: 800 }}>
        <svg viewBox="-120 -120 240 240" width={800} height={800} style={{ rotate: `${giro}deg` }}>
          <circle r={117} fill={C.display} />
          {PREMIOS.map((p, i) => {
            const a0 = ((i * paso - 90) * Math.PI) / 180;
            const a1 = (((i + 1) * paso - 90) * Math.PI) / 180;
            const fondo = GAJOS[i % 4];
            const tinta = fondo === C.tinta ? C.rollo : C.tinta;
            return (
              <g key={p}>
                <path d={`M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`} fill={fondo} stroke={C.tinta} strokeWidth={2.5} />
                <text transform={`rotate(${i * paso + paso / 2 - 90}) translate(${R - 10} 5)`} textAnchor="end" fill={tinta} style={{ fontFamily: "Archivo", fontWeight: 900, fontStretch: "62%", fontSize: 15, textTransform: "uppercase" }}>
                  {p}
                </text>
              </g>
            );
          })}
          <circle r={24} fill={C.display} stroke={C.rollo} strokeWidth={4} />
          <circle r={7} fill={C.led} />
        </svg>
        <div style={{ position: "absolute", left: 400 - 34, top: -14, width: 0, height: 0, borderLeft: "34px solid transparent", borderRight: "34px solid transparent", borderTop: `70px solid ${C.tinta}` }} />
      </div>
    </Fondo>
  );
};

/** 8 · Cierre: oferta y prueba social. */
export const Cierre: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sello = spring({ frame: frame - 22, fps, config: { damping: 12 } });
  return (
    <Fondo oscuro>
      <div style={{ position: "absolute", left: 84, top: 150 }}>
        <Marca oscuro tam={64} />
      </div>
      <Titulo oscuro top={310} lineas={["Primer", "mes", "gratis"]} acento={2} />
      <div
        style={{
          position: "absolute",
          left: 84,
          right: 84,
          top: 1010,
          display: "flex",
          alignItems: "center",
          gap: 30,
          background: C.papel,
          borderRadius: 28,
          padding: "30px 36px",
          opacity: sello,
          scale: interpolate(sello, [0, 1], [1.3, 1]),
          rotate: "-2deg",
        }}
      >
        <Img src={staticFile("logo-inspirationmen.png")} style={{ width: 120, height: 120, borderRadius: 60, background: C.tinta }} />
        <div>
          <div style={{ fontSize: 34, fontWeight: 600, color: C.gastada }}>Ya lo usa</div>
          <div style={{ fontSize: 64, fontWeight: 900, fontStretch: "62%", textTransform: "uppercase", color: C.tinta }}>Inspirationmen</div>
          <div style={{ fontSize: 30, fontWeight: 600, color: C.gastada }}>Diagonal 74 y 56, La Plata</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 84, right: 84, top: 1320, fontSize: 50, fontWeight: 700, color: C.papel, lineHeight: 1.25, opacity: interpolate(frame, [40, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        Te la dejamos lista en un día.
        <br />
        <span style={{ color: C.rollo }}>Escribinos y te la mostramos.</span>
      </div>
      <div style={{ position: "absolute", left: 84, bottom: 150, fontSize: 40, fontWeight: 600, color: "#CDBFAE" }}>navagenda-web.onrender.com</div>
    </Fondo>
  );
};
