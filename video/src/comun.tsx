import { loadFont } from "@remotion/fonts";
import type React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// La misma tipografía de la web: Archivo variable (ancho 62–125)
loadFont({ family: "Archivo", url: staticFile("Archivo.ttf"), weight: "100 900", stretch: "62% 125%" });

export const C = {
  rollo: "#F6D13A",
  tinta: "#141210",
  papel: "#FFFDF3",
  display: "#120C0B",
  led: "#FF2B1C",
  gastada: "#3D3310",
};

/** Fondo: amarillo de rollo de turnos o tinta. */
export const Fondo: React.FC<{ oscuro?: boolean; children: React.ReactNode }> = ({ oscuro, children }) => (
  <AbsoluteFill style={{ backgroundColor: oscuro ? C.tinta : C.rollo, fontFamily: "Archivo" }}>{children}</AbsoluteFill>
);

/** Título grande arriba a la izquierda, palabra por palabra. */
export const Titulo: React.FC<{ lineas: string[]; sub?: string; oscuro?: boolean; acento?: number; top?: number }> = ({ lineas, sub, oscuro, acento, top = 150 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 84, right: 84, top }}>
      {lineas.map((l, i) => {
        const s = spring({ frame: frame - i * 4, fps, config: { damping: 200 } });
        return (
          <div
            key={l}
            style={{
              fontWeight: 900,
              fontStretch: "62%",
              fontSize: 150,
              lineHeight: 0.88,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              color: i === acento ? C.led : oscuro ? C.papel : C.tinta,
              opacity: s,
              translate: `0px ${interpolate(s, [0, 1], [50, 0])}px`,
            }}
          >
            {l}
          </div>
        );
      })}
      {sub && (
        <div
          style={{
            marginTop: 30,
            fontSize: 46,
            fontWeight: 600,
            lineHeight: 1.2,
            color: oscuro ? "#E9DFCF" : C.gastada,
            opacity: interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
};

/** Celular con una captura real; sube con un resorte y la pantalla puede deslizarse (desde/hasta en % del alto). */
export const Celular: React.FC<{ src: string; top?: number; desde?: number; hasta?: number; inclinado?: number; children?: React.ReactNode }> = ({
  src,
  top = 640,
  desde = 0,
  hasta = 0,
  inclinado = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const entra = spring({ frame: frame - 6, fps, config: { damping: 18, mass: 0.9 } });
  const ancho = 640;
  const alto = Math.round(ancho * (2532 / 1170));
  const scroll = interpolate(frame, [24, durationInFrames - 10], [desde, hasta], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.2, 1),
  });
  return (
    <div
      style={{
        position: "absolute",
        left: (1080 - ancho - 36) / 2,
        top,
        width: ancho + 36,
        height: alto + 36,
        borderRadius: 86,
        background: "#0b0a09",
        padding: 18,
        boxShadow: "0 40px 80px rgba(0,0,0,.35)",
        translate: `0px ${interpolate(entra, [0, 1], [700, 0])}px`,
        rotate: `${inclinado * (1 - entra) + inclinado}deg`,
      }}
    >
      <div style={{ width: ancho, height: alto, borderRadius: 70, overflow: "hidden", position: "relative", background: C.tinta }}>
        <Img src={staticFile(src)} style={{ width: ancho, display: "block", translate: `0px ${-scroll * alto}px` }} />
        {children}
      </div>
    </div>
  );
};

/** Marca "Nº NAVAGENDA" como en la web. */
export const Marca: React.FC<{ oscuro?: boolean; tam?: number }> = ({ oscuro, tam = 54 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: tam * 0.35 }}>
    <span
      style={{
        background: oscuro ? C.rollo : C.tinta,
        color: oscuro ? C.tinta : C.rollo,
        fontWeight: 900,
        fontStretch: "62%",
        fontSize: tam * 0.8,
        padding: `${tam * 0.08}px ${tam * 0.22}px`,
      }}
    >
      Nº
    </span>
    <span style={{ fontWeight: 900, fontStretch: "62%", fontSize: tam, letterSpacing: "0.02em", color: oscuro ? C.papel : C.tinta }}>NAVAGENDA</span>
  </div>
);
