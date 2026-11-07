/* Mockups: celular y portátil. El contenido va dentro de la pantalla. */
import type { CSSProperties, ReactNode } from "react";
import { C, display } from "../theme";
import { Icono } from "./Icono";
import { Img, staticFile } from "remotion";

export const Celular: React.FC<{ width: number; children: ReactNode; style?: CSSProperties }> = ({ width, children, style }) => {
  const pad = width * 0.034;
  return (
    <div
      style={{
        width,
        height: width * 2.06,
        borderRadius: width * 0.15,
        padding: pad,
        background: "linear-gradient(145deg, #23324a, #05080e)",
        boxShadow: `0 ${width * 0.12}px ${width * 0.3}px -${width * 0.06}px rgba(0,0,0,.6), inset 0 0 0 ${width * 0.006}px rgba(255,255,255,.2)`,
        position: "relative",
        ...style,
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: width * 0.12, overflow: "hidden", background: C.bg, position: "relative" }}>
        {children}
        <div
          style={{
            position: "absolute",
            top: width * 0.025,
            left: "50%",
            transform: "translateX(-50%)",
            width: width * 0.3,
            height: width * 0.075,
            borderRadius: 999,
            background: "#05080e",
            zIndex: 50,
          }}
        />
      </div>
    </div>
  );
};

export const Portatil: React.FC<{ width: number; url: string; children: ReactNode; style?: CSSProperties }> = ({ width, url, children, style }) => {
  const s = width / 1000;
  return (
    <div style={{ width, display: "flex", flexDirection: "column", alignItems: "center", ...style }}>
      <div
        style={{
          width,
          height: width * 0.6,
          borderRadius: 26 * s,
          padding: 18 * s,
          background: "linear-gradient(160deg, #23324a, #05080e)",
          boxShadow: `0 ${60 * s}px ${120 * s}px -${30 * s}px rgba(0,0,0,.6), inset 0 0 0 ${3 * s}px rgba(255,255,255,.14)`,
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 10 * s, overflow: "hidden", background: "#dfe5ee", display: "flex", flexDirection: "column" }}>
          <div style={{ height: 44 * s, background: C.white, display: "flex", alignItems: "center", gap: 9 * s, padding: `0 ${18 * s}px`, borderBottom: `1px solid ${C.line}` }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <div key={c} style={{ width: 13 * s, height: 13 * s, borderRadius: "50%", background: c }} />
            ))}
            <div
              style={{
                marginLeft: 20 * s,
                flex: 1,
                height: 26 * s,
                borderRadius: 999,
                background: C.bg,
                color: C.slate,
                fontSize: 14 * s,
                display: "flex",
                alignItems: "center",
                paddingLeft: 16 * s,
                fontFamily: display,
              }}
            >
              {url}
            </div>
          </div>
          <div style={{ flex: 1, position: "relative" }}>{children}</div>
        </div>
      </div>
      <div style={{ width: width * 1.14, height: 30 * s, borderRadius: `0 0 ${30 * s}px ${30 * s}px`, background: "linear-gradient(#c9d2de, #7d8796)" }} />
    </div>
  );
};

/* Barra superior del portal dentro del celular: marca + campanita. */
export const BarraPortal: React.FC<{ s: number; badge?: number; sacudir?: number }> = ({ s, badge = 0, sacudir = 0 }) => (
  <div
    style={{
      paddingTop: 46 * s,
      height: 112 * s,
      background: C.navy,
      display: "flex",
      alignItems: "center",
      padding: `${46 * s}px ${20 * s}px 0`,
      gap: 12 * s,
      boxSizing: "border-box",
    }}
  >
    <div style={{ width: 40 * s, height: 40 * s, borderRadius: 12 * s, background: C.white, display: "grid", placeItems: "center", overflow: "hidden" }}>
      <Img src={staticFile("logo.svg")} style={{ width: 36 * s }} />
    </div>
    <div style={{ flex: 1, color: C.white, fontFamily: display, fontWeight: 800, fontSize: 19 * s }}>
      Servimantos
      <div style={{ fontWeight: 500, fontSize: 12 * s, color: "rgba(255,255,255,.6)" }}>Portal de reportes</div>
    </div>
    <div style={{ position: "relative", color: C.white, transform: `rotate(${sacudir}deg)`, transformOrigin: "50% 10%" }}>
      <Icono name="bell" size={28 * s} />
      {badge > 0 && (
        <div
          style={{
            position: "absolute",
            top: -8 * s,
            right: -10 * s,
            minWidth: 22 * s,
            height: 22 * s,
            borderRadius: 999,
            background: C.orange,
            color: C.white,
            fontSize: 13 * s,
            fontWeight: 800,
            display: "grid",
            placeItems: "center",
            fontFamily: display,
          }}
        >
          {badge}
        </div>
      )}
    </div>
  </div>
);
