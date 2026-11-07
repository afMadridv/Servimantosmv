/* 4 · Portátil: el PDF se dibuja con la geometría real de portal/js/pdf.js
   (A4 595×842 pt; aquí con y invertida), luego barra de progreso y descarga. */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Banner } from "../components/Aviso";
import { FotoObra, Kicker, Titulo } from "../components/Comunes";
import { Portatil } from "../components/Dispositivos";
import { Icono } from "../components/Icono";
import { useLayout } from "../hooks";
import { body, C, clamp, display } from "../theme";

const H = 842;
const y = (pt: number) => H - pt; // pdf (origen abajo) → svg (origen arriba)
const ML = 42.12, MR = 553.29, X1 = 135.98, X2 = 390.31;
const TOP = y(830.28), HEAD = y(765.48), R1 = y(739.9), R2 = y(717.22), BAN = y(687.94), BOT = y(88.1);

const LINEAS: [number, number, number, number][] = [
  [ML, TOP, MR, TOP], [ML, HEAD, MR, HEAD], [ML, R1, MR, R1], [ML, R2, MR, R2], [ML, BAN, MR, BAN],
  [ML, TOP, ML, BOT], [MR, TOP, MR, BOT], [X1, TOP, X1, R2], [X2, TOP, X2, R2], [ML, BOT, MR, BOT],
];
const PIES = ["Fisura en junta de placa", "Manto con burbuja", "Bajante obstruido", "Limpieza y retiro de arena"];

const Pagina: React.FC<{ f: number }> = ({ f }) => {
  const trazo = interpolate(f, [8, 70], [0, 1], clamp);
  const textos = interpolate(f, [55, 95], [0, 1], clamp);
  const franja = interpolate(f, [90, 110], [0, 1], clamp);
  const t = (x: number, yy: number, txt: string, size: number, bold = false, extra: React.SVGProps<SVGTextElement> = {}) => (
    <text x={x} y={yy} fontSize={size} fontWeight={bold ? 700 : 400} fill="#17243b" fontFamily="Helvetica, Arial, sans-serif" opacity={textos} {...extra}>
      {txt}
    </text>
  );
  const cw = (MR - ML - 30) / 2;
  return (
    <div style={{ position: "relative", height: "100%", aspectRatio: `595 / ${H}`, background: C.white, boxShadow: "0 20px 50px -15px rgba(12,36,64,.45)" }}>
      <svg viewBox={`0 0 595 ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <rect x={ML} y={R2} width={MR - ML} height={BAN - R2} fill={C.navy} opacity={franja} />
        <text x={(ML + MR) / 2} y={R2 + 19} fontSize="10.5" fontWeight={700} fill="#fff" textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" opacity={franja}>
          ACTIVIDADES PENDIENTES POR REALIZAR EN LA CUBIERTA
        </text>
        {LINEAS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#202939" strokeWidth={0.9} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - trazo} />
        ))}
        {t((X1 + X2) / 2, TOP + 38, "INFORME DE OBRA", 17, true, { textAnchor: "middle" })}
        {t((X2 + MR) / 2, TOP + 18, "INF-VT-014", 11, true, { textAnchor: "middle", fill: C.orange })}
        {t((X2 + MR) / 2, TOP + 36, "26/10/26", 10, false, { textAnchor: "middle" })}
        {t((X2 + MR) / 2, TOP + 54, "1/2", 10, false, { textAnchor: "middle" })}
        {t(ML + 6, HEAD + 17, "Proyecto", 11, true)}
        {t(X1 + 6, HEAD + 17, "Edificio Altamar · Torre 2", 11)}
        {t(X2 + 6, HEAD + 17, "OS-26-031", 11, true)}
        {t(ML + 6, R1 + 15, "Solicitante", 11, true)}
        {t(X1 + 6, R1 + 15, "Ing. Laura Gómez", 11)}
        {t(X2 + 6, R1 + 15, "Contrato  OS 26 00045", 11, true)}
        {PIES.map((p, i) => {
          const x = ML + 10 + (i % 2) * (cw + 10);
          const yy = BAN + 14 + Math.floor(i / 2) * 296;
          return (
            <text key={p} x={x + cw / 2} y={yy + 268} fontSize={10} fill="#17243b" textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" opacity={interpolate(f, [130 + i * 10, 150 + i * 10], [0, 1], clamp)}>
              {p}
            </text>
          );
        })}
        <line x1={ML} y1={BOT + 14} x2={MR} y2={BOT + 14} stroke={C.orange} strokeWidth={2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - trazo} />
        {t((ML + MR) / 2, BOT + 32, "SERVIMANTOS MV · Barranquilla · Santa Marta, Colombia", 8, false, { textAnchor: "middle", fill: "#748296" })}
      </svg>
      {/* El logo y las fotos van como HTML para que Remotion espere a que carguen. */}
      <Img
        src={staticFile("logo.svg")}
        style={{ position: "absolute", left: `${((ML + 8) / 595) * 100}%`, top: `${((TOP + 6) / H) * 100}%`, width: `${((X1 - ML - 16) / 595) * 100}%`, opacity: textos }}
      />
      {PIES.map((p, i) => {
        const x = ML + 10 + (i % 2) * (cw + 10);
        const yy = BAN + 14 + Math.floor(i / 2) * 296;
        const e = interpolate(f, [120 + i * 10, 140 + i * 10], [0, 1], clamp);
        return (
          <div
            key={p}
            style={{
              position: "absolute",
              left: `${(x / 595) * 100}%`,
              top: `${(yy / H) * 100}%`,
              width: `${(cw / 595) * 100}%`,
              height: `${(250 / H) * 100}%`,
              opacity: e,
              transform: `scale(${0.85 + 0.15 * e})`,
            }}
          >
            <FotoObra i={i} style={{ width: "100%", height: "100%" }} />
          </div>
        );
      })}
    </div>
  );
};

export const Pdf: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();

  const W = (vertical ? 980 : 1240) * u;
  const s = W / 1000;
  const entra = spring({ frame: f, fps, config: { damping: 20 } });
  const progreso = interpolate(f, [190, 265], [0, 100], clamp);
  const barra = spring({ frame: f - 180, fps, config: { damping: 200 } });
  const descarga = spring({ frame: f - 268, fps, config: { damping: 13 } });
  const aviso = spring({ frame: f - 290, fps, config: { damping: 15 } });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 70% 20%, ${C.navy2}, ${C.night})` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: (vertical ? 70 : 34) * u }}>
        <div style={{ textAlign: "center" }}>
          <Kicker size={24 * u}>pdf-lib · todo en el navegador</Kicker>
          <div style={{ marginTop: 14 * u }}>
            <Titulo texto={vertical ? "El PDF se arma solo" : "El PDF se arma solo, al milímetro"} size={(vertical ? 96 : 66) * u} delay={4} align="center" />
          </div>
        </div>

        <div style={{ position: "relative", transform: `translateY(${(1 - entra) * 300 * u}px) perspective(${2000 * u}px) rotateX(${(1 - entra) * 20}deg)` }}>
          <Portatil width={W} url="servimantosmv.vercel.app/portal/#reporte">
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 22 * s, background: "#525a66" }}>
              <Pagina f={f} />
            </div>
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 30 * s,
                width: 520 * s,
                transform: `translateX(-50%) translateY(${(1 - barra) * 60 * s}px)`,
                opacity: barra * (1 - descarga),
                padding: 20 * s,
                borderRadius: 18 * s,
                background: C.white,
                fontFamily: body,
                boxShadow: "0 20px 50px -20px rgba(0,0,0,.5)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20 * s, fontWeight: 600, color: C.ink }}>
                <span>Generando PDF…</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(progreso)}%</span>
              </div>
              <div style={{ marginTop: 12 * s, height: 12 * s, borderRadius: 99, background: C.line, overflow: "hidden" }}>
                <div style={{ width: `${progreso}%`, height: "100%", background: C.grad }} />
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 30 * s,
                transform: `translateX(-50%) scale(${descarga})`,
                display: "flex",
                alignItems: "center",
                gap: 14 * s,
                padding: `${16 * s}px ${26 * s}px`,
                borderRadius: 999,
                background: C.ok,
                color: C.white,
                fontFamily: display,
                fontWeight: 700,
                fontSize: 22 * s,
                whiteSpace: "nowrap",
              }}
            >
              <Icono name="download" size={26 * s} /> INF-VT-014_Edificio-Altamar.pdf
            </div>
          </Portatil>

          <div
            style={{
              position: "absolute",
              width: (vertical ? 760 : 540) * u,
              right: vertical ? 110 * u : -170 * u,
              top: vertical ? undefined : 70 * u,
              bottom: vertical ? -150 * u : undefined,
              opacity: aviso,
              transform: `translateX(${(1 - aviso) * 200 * u}px) rotate(${(1 - aviso) * 6}deg)`,
            }}
          >
            <Banner s={(vertical ? 1.6 : 1.15) * u} tono="ok" titulo="Reporte INF-VT-014 listo" cuerpo="Reporte de Obra · Edificio Altamar · Torre 2" accion="Ver historial" />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
