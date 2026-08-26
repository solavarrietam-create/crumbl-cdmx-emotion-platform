import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import { Group } from "three";
import { fetchGraph, fetchReading } from "./api";

const ACTIVE_WEEK = "2026-W35";

const CORE_FAMILY_COLOR = {
  core_anger: "#ff1c1c",
  core_fear: "#1e9f2a",
  core_happiness: "#ffe44c",
  core_surprise: "#4aa7e8",
  core_sadness: "#4b46d6",
  core_disgust: "#d83be8"
};

const CORE_FAMILY_EMOJI = {
  core_anger: "😡",
  core_fear: "😨",
  core_happiness: "😀",
  core_surprise: "😮",
  core_sadness: "😢",
  core_disgust: "🤢"
};

const SHADE_EMOJI = {
  shade_fright: "😨", shade_terror: "😱", shade_dread: "😰", shade_verguenza: "😳",
  shade_anxiety: "😟", shade_apprehension: "😬", shade_nervousness: "😥", shade_concern: "😕",
  shade_consternation: "😧", shade_misgiving: "😦", shade_wariness: "🤨", shade_qualm: "🤔",
  shade_edginess: "😖", shade_phobia: "😵", shade_panic: "😫",
  shade_resentment: "😶", shade_indignation: "😤", shade_acrimony: "😡", shade_vexation: "😣",
  shade_envidia: "😏", shade_annoyance: "🙄", shade_exasperation: "😩", shade_fury: "🤬",
  shade_outrage: "😠", shade_wrath: "👿", shade_animosity: "😾", shade_irritability: "😑",
  shade_hostility: "😈", shade_hatred: "💢", shade_violence: "👺",
  shade_contentment: "🙂", shade_gratification: "😄", shade_satisfaction: "😊", shade_delight: "😁",
  shade_joy: "😃", shade_relief: "😌", shade_bliss: "🥰", shade_amusement: "😆",
  shade_pride: "😎", shade_sensual_pleasure: "😘", shade_thrill: "🤪", shade_rapture: "😍",
  shade_euphoria: "🤗", shade_whimsy: "😜", shade_ecstasy: "🤩", shade_mania: "🥳",
  shade_grief: "😭", shade_sorrow: "😢", shade_cheerlessness: "😔", shade_gloom: "😞",
  shade_melancholy: "😟", shade_selfpity: "🥺", shade_loneliness: "😿", shade_dejection: "😓",
  shade_despair: "😩", shade_depression_word: "☹️",
  shade_shock: "😮", shade_astonishment: "😲", shade_amazement: "🤯", shade_wonder: "😯",
  shade_contempt: "😒", shade_disdain: "😌", shade_scorn: "😏", shade_verguenza_ajena: "🫣",
  shade_abhorrence: "🤮", shade_aversion: "🤢", shade_distaste: "😗", shade_revulsion: "🤧"
};

const MIX_WITH_WHITE = {
  alto: 0.05,
  medio: 0.28,
  pendiente: 0.58
};

const RELATION_LABEL_ES = {
  compensatory_attack: "ataque compensatorio",
  normative_justification: "justificación normativa",
  escalation_risk: "riesgo de escalamiento",
  protective_reframing: "reencuadre protector",
  counter_stigma: "contraestigma"
};

const RELATION_LABEL_EN = {
  compensatory_attack: "compensatory attack",
  normative_justification: "normative justification",
  escalation_risk: "escalation risk",
  protective_reframing: "protective reframing",
  counter_stigma: "counter-stigma"
};

const READING_COPY_EN = {
  title: "Emotional mapping of Crumbl Cookies CDMX opening",
  notes: "Source: Social Listening on TikTok and Instagram (97 classified pieces from 13 posts). Class-contempt and economic indignation domain.",
  dimensions: {
    "core-disgust": {
      label: "Class contempt and rejection",
      description: "68.1% of classified corpus. Dominant pole: rejection via comparison with traditional Mexican food, disdain for 'belonging', and vicarious shame."
    },
    "core-anger": {
      label: "Economic and nationalist indignation",
      description: "17.0% of classified corpus. Moral anger over price/scalping, call for local consumption, envy of free time, and annoyance."
    },
    "core-surprise": {
      label: "Astonishment at queue behavior",
      description: "4.3% of classified corpus. Astonishment at the disproportion between stimulus (cookie) and behavior (overnight camping)."
    },
    "core-happiness": {
      label: "Tolerant enjoyment and neutral pretext",
      description: "4.3% of classified corpus. Gratification framed as a gift or collectible, and 'live and let live' tolerance."
    },
    "core-sadness": {
      label: "Disappointment over taste expectation",
      description: "3.2% of classified corpus. Isolated sadness over the gap between price/wait and perceived flavor."
    },
    "core-fear": {
      label: "Insecurity and concern",
      description: "3.2% of classified corpus. Isolated concern for personal safety during overnight street queues."
    }
  },
  relationEvidence: {
    compensatory_attack: "Vicarious shame from public exposure is channeled as class-based culinary mockery.",
    normative_justification: "Contempt for the product is justified by a moral claim to support Mexican bakeries and local business.",
    escalation_risk: "Envy of free time or privilege is reframed as economic or class indignation.",
    protective_reframing: "Individual enjoyment hides behind tolerant adult framing or gift pretexts to avoid stigma."
  }
};

const CONFIDENCE_LABEL_ES = {
  high: "alta",
  medium: "media",
  low: "baja"
};

const CONFIDENCE_LABEL_EN = {
  high: "high",
  medium: "medium",
  low: "low"
};

function getIntensityLevel(value, labels) {
  if (!value) return labels.none;
  if (value >= 0.7) return labels.high;
  if (value >= 0.3) return labels.medium;
  return labels.low;
}

function mixWithWhite(hexColor, ratio) {
  const safeHex = (hexColor ?? "#8aa0b8").replace("#", "");
  const r = parseInt(safeHex.substring(0, 2), 16);
  const g = parseInt(safeHex.substring(2, 4), 16);
  const b = parseInt(safeHex.substring(4, 6), 16);

  const mixedR = Math.round(r + (255 - r) * ratio);
  const mixedG = Math.round(g + (255 - g) * ratio);
  const mixedB = Math.round(b + (255 - b) * ratio);

  return `rgb(${mixedR}, ${mixedG}, ${mixedB})`;
}

function toGraphData(payload) {
  const readingActivationMap = new Map(
    (payload.reading?.activations ?? []).map((a) => [a.shade_id, a])
  );
  const readingDimensionMap = new Map(
    (payload.reading?.dimensions ?? []).map((d) => [d.id.replace("-", "_"), d])
  );

  const coreNodes = payload.nodes.filter((node) => node.type === "core");
  const familyBackbone = coreNodes.map((node, index) => {
    const nextNode = coreNodes[(index + 1) % coreNodes.length];
    return {
      source: node.id,
      target: nextNode.id,
      id: `backbone_${node.id}_${nextNode.id}`,
      relation: "emotional_family",
      link_type: "backbone",
      weight_current: 0.35,
      evidence: "Conexión visual entre familias emocionales",
      color: "rgba(210, 224, 239, 0.58)"
    };
  });

  return {
    nodes: payload.nodes.map((n) => ({
      activation: readingActivationMap.get(n.id),
      id: n.id,
      label: n.label,
      description: n.description,
      type: n.type,
      parent: n.parent,
      intensity: n.type === "core"
        ? readingDimensionMap.get(n.id)?.intensity ?? 0
        : readingActivationMap.get(n.id)?.weight ?? 0,
      mx_weight: n.mx_weight,
      val: (() => {
        const activationWeight = readingActivationMap.get(n.id)?.weight ?? 0;
        if (n.type === "core") {
          return 9;
        }
        if (activationWeight > 0) {
          return 4 + (activationWeight * 55);
        }
        return 0.75;
      })(),
      color:
        n.type === "core"
          ? (CORE_FAMILY_COLOR[n.id] ?? "#0f8ea0")
          : mixWithWhite(
              CORE_FAMILY_COLOR[n.parent] ?? "#0f8ea0",
              MIX_WITH_WHITE[n.mx_weight] ?? MIX_WITH_WHITE.pendiente
            )
    })),
    links: [
      ...familyBackbone,
      ...payload.edges.map((e) => ({
        source: e.source,
        target: e.target,
        id: e.id,
        relation: e.relation,
        link_type: "taxonomy",
        weight_current: e.weight_current ?? 0,
        evidence: "Relacion estructural shade->core",
        color: e.weight_current > 0
          ? "rgba(154, 207, 239, 0.92)"
          : "rgba(103, 122, 146, 0.72)"
      })),
      ...(payload.reading?.relations ?? []).map((r, idx) => ({
        source: r.from_shade_id,
        target: r.to_shade_id,
        id: `rel_${idx}_${r.from_shade_id}_${r.to_shade_id}`,
        relation: r.relation,
        link_type: "reading",
        weight_current: r.weight,
        evidence: r.evidence,
        color: "rgba(109, 196, 250, 0.95)"
      }))
    ]
  };
}

export default function App() {
  const [lang, setLang] = useState("es");
  const [rawData, setRawData] = useState(null);
  const [reading, setReading] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const graphRef = useRef(null);

  const graphData = useMemo(() => {
    if (!rawData) return { nodes: [], links: [] };
    return toGraphData({ ...rawData, reading });
  }, [rawData, reading]);

  const nodeLabelById = useMemo(() => {
    const map = new Map();
    if (!rawData?.nodes) return map;
    for (const node of rawData.nodes) {
      map.set(node.id, node.label);
    }
    return map;
  }, [rawData]);

  const ui = useMemo(() => {
    if (lang === "en") {
      return {
        title: "Emotions of Crumbl Cookies CDMX",
        subtitle: `Browse by language. This view uses the fixed reading for week ${ACTIVE_WEEK}.`,
        language: "Language",
        spanish: "Spanish",
        english: "English",
        mapDescription: "What this map shows",
        noReading: "No weekly reading is available for this week.",
        activeShades: "Activated shades",
        emotionalRelations: "Emotional relations",
        noRelations: "No reading relations are available for this week.",
        clickNode: "Click a node to see its details.",
        confidence: "confidence",
        weight: "weight",
        shadeType: "shade",
        emotionType: "emotion",
        intensity: { high: "high", medium: "medium", low: "low", none: "none" },
        navigation: "Left: rotate · Wheel/middle: zoom · Right: pan",
        legendJoy: "Happiness",
        legendFear: "Fear",
        legendAnger: "Anger",
        legendSadness: "Sadness",
        legendSurprise: "Surprise",
        legendDisgust: "Disgust",
        loading: "Loading graph...",
        error: "Unable to load the graph."
      };
    }
    return {
      title: "Emociones de Crumbl Cookies CDMX",
      subtitle: `Consulta por idioma. Esta vista usa la lectura fija de la semana ${ACTIVE_WEEK}.`,
      language: "Idioma",
      spanish: "Español",
      english: "Inglés",
      mapDescription: "Qué muestra este mapa",
      noReading: "No hay lectura semanal para esta semana.",
      activeShades: "Matices activados",
      emotionalRelations: "Relaciones emocionales",
      noRelations: "No hay relaciones de lectura para esta semana.",
      clickNode: "Haz clic en un nodo para ver su detalle.",
      confidence: "confianza",
      weight: "peso",
      shadeType: "matiz",
      emotionType: "emoción",
      intensity: { high: "alto", medium: "medio", low: "bajo", none: "nulo" },
      navigation: "Izquierdo: rotar · Rueda/medio: zoom · Derecho: desplazar",
      legendJoy: "Felicidad",
      legendFear: "Miedo",
      legendAnger: "Enojo",
      legendSadness: "Tristeza",
      legendSurprise: "Sorpresa",
      legendDisgust: "Asco",
      loading: "Cargando grafo...",
      error: "No se pudo cargar el grafo."
    };
  }, [lang]);

  const sortedActivations = useMemo(() => {
    if (!reading?.activations) return [];
    return [...reading.activations].sort((a, b) => b.weight - a.weight);
  }, [reading]);

  const sortedRelations = useMemo(() => {
    if (!reading?.relations) return [];
    return [...reading.relations].sort((a, b) => b.weight - a.weight);
  }, [reading]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        setSelectedNode(null);
        const graphPayload = await fetchGraph({ lang, week: ACTIVE_WEEK });
        let readingPayload = null;
        try {
          readingPayload = await fetchReading(ACTIVE_WEEK);
        } catch {
          readingPayload = null;
        }
        if (!cancelled) {
          setRawData(graphPayload);
          setReading(readingPayload);
        }
      } catch {
        if (!cancelled) {
          setError(ui.error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [lang, ui.error]);

  return (
    <main className="app-shell">
      <aside className="control-panel">
        <h1>{ui.title}</h1>
        <p className="subtitle">{ui.subtitle}</p>

        <section className="controls">
          <label>
            {ui.language}
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="es">{ui.spanish}</option>
              <option value="en">{ui.english}</option>
            </select>
          </label>
        </section>

        <section className="detail-card">
          <h2>{ui.mapDescription}</h2>
          {reading ? (
            <>
              <p className="edge-caption">{lang === "en" ? READING_COPY_EN.title : reading.title}</p>
              <p>{lang === "en" ? READING_COPY_EN.notes : reading.notes}</p>
              <div className="dimension-list">
                {reading.dimensions.map((d) => (
                  <div key={d.id} className="dimension-row">
                    <div className="dimension-head">
                      <strong>{lang === "en" ? READING_COPY_EN.dimensions[d.id]?.label ?? d.label : d.label}</strong>
                      <span>{Math.round(d.intensity * 100)}%</span>
                    </div>
                    <div className="dimension-bar">
                      <span style={{ width: `${Math.round(d.intensity * 100)}%` }} />
                    </div>
                    <p>{lang === "en" ? READING_COPY_EN.dimensions[d.id]?.description ?? d.description : d.description}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p>{ui.noReading}</p>
          )}
        </section>

        <section className="detail-card">
          <h2>{ui.activeShades}</h2>
          {sortedActivations.slice(0, 8).map((a) => (
            <div key={a.shade_id} className="activation-row">
              <div className="dimension-head">
                <strong>{nodeLabelById.get(a.shade_id) ?? a.shade_id.replace("shade_", "")}</strong>
                <span>{a.weight.toFixed(2)}</span>
              </div>
              <div className="dimension-bar small">
                <span style={{ width: `${Math.round(a.weight * 100)}%` }} />
              </div>
              <p className="edge-caption">{ui.confidence}: {(lang === "en" ? CONFIDENCE_LABEL_EN : CONFIDENCE_LABEL_ES)[a.confidence] ?? a.confidence}</p>
            </div>
          ))}
        </section>

        <section className="detail-card">
          <h2>{ui.emotionalRelations}</h2>
          {sortedRelations.length ? (
            sortedRelations.slice(0, 6).map((r) => (
              <div key={`${r.from_shade_id}-${r.to_shade_id}`} className="relation-row">
                <div className="dimension-head">
                  <strong>
                    {nodeLabelById.get(r.from_shade_id) ?? r.from_shade_id.replace("shade_", "")}
                    {" -> "}
                    {nodeLabelById.get(r.to_shade_id) ?? r.to_shade_id.replace("shade_", "")}
                  </strong>
                  <span>{r.weight.toFixed(2)}</span>
                </div>
                <p className="edge-caption">{(lang === "en" ? RELATION_LABEL_EN : RELATION_LABEL_ES)[r.relation] ?? r.relation}</p>
                <p className="edge-caption">{lang === "en" ? READING_COPY_EN.relationEvidence[r.relation] ?? r.evidence : r.evidence}</p>
              </div>
            ))
          ) : (
            <p>{ui.noRelations}</p>
          )}
        </section>

        <section className="legend">
          <div><span className="dot joy" /> {ui.legendJoy}</div>
          <div><span className="dot fear" /> {ui.legendFear}</div>
          <div><span className="dot anger" /> {ui.legendAnger}</div>
          <div><span className="dot sadness" /> {ui.legendSadness}</div>
          <div><span className="dot surprise" /> {ui.legendSurprise}</div>
          <div><span className="dot disgust" /> {ui.legendDisgust}</div>
        </section>

        <section className="detail-card">
          {selectedNode ? (
            <>
              <h2>{selectedNode.label}</h2>
              <p>{selectedNode.description}</p>
              <p className="edge-caption">{ui.weight}: {getIntensityLevel(selectedNode.intensity, ui.intensity)}</p>
            </>
          ) : (
            <p>{ui.clickNode}</p>
          )}
        </section>

        {loading && <p className="status">{ui.loading}</p>}
        {error && <p className="status error">{error}</p>}
      </aside>

      <section className="graph-panel">
        <div className="graph-bg-shape" />
        <div className="nav-hint">{ui.navigation}</div>
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          backgroundColor="#050713"
          nodeRelSize={6}
          d3VelocityDecay={0.62}
          d3AlphaDecay={0.08}
          d3Force={(forceName, force) => {
            if (forceName === "link") {
              force
                .distance((link) => (link.link_type === "backbone" ? 34 : link.link_type === "reading" ? 34 : 22))
                .strength((link) => (link.link_type === "backbone" ? 0.9 : link.link_type === "reading" ? 0.8 : 0.6));
            }
            if (forceName === "charge") {
              force.strength(-8);
            }
          }}
          onEngineStop={() => graphRef.current?.zoomToFit(600, 36)}
          nodeThreeObjectExtend={false}
          nodeThreeObject={(node) => {
            const activationWeight = node.activation?.weight ?? 0;
            const familyId = node.type === "core" ? node.id : node.parent;
            const emoji = new SpriteText(SHADE_EMOJI[node.id] ?? CORE_FAMILY_EMOJI[familyId] ?? "🙂");
            const intensity = getIntensityLevel(node.intensity, ui.intensity);
            const label = new SpriteText(`${node.label} · ${intensity}`);
            const group = new Group();

            const visualWeight = node.intensity ?? activationWeight;
            emoji.textHeight = node.type === "core"
              ? 5 + visualWeight * 30
              : visualWeight > 0
                ? 2 + visualWeight * 28
                : 0.8;
            emoji.position.set(0, 0, 0);
            emoji.renderOrder = 1000;
            if (emoji.material) {
              emoji.material.depthTest = false;
              emoji.material.depthWrite = false;
            }

            label.color = "#f4f7ff";
            label.backgroundColor = "rgba(5, 7, 19, 0.78)";
            label.padding = 3;
            label.borderRadius = 3;
            label.textHeight = node.type === "core" ? 4.8 : 2.5;
            label.position.set(0, emoji.textHeight * 0.72 + 4, 0);
            label.renderOrder = 1001;
            if (label.material) {
              label.material.depthTest = false;
              label.material.depthWrite = false;
            }

            group.add(emoji);
            group.add(label);
            return group;
          }}
          showNavInfo={false}
          linkColor={(l) => l.color}
          linkWidth={(l) =>
            l.link_type === "backbone"
              ? 1.4
              : l.link_type === "reading"
                ? 1 + (l.weight_current ?? 0) * 7
                : 1.35 + (l.weight_current ?? 0) * 5.5
          }
          linkDirectionalParticles={(l) =>
            l.link_type === "backbone"
              ? 0
              : l.link_type === "reading"
                ? Math.round((l.weight_current ?? 0) * 3)
                : Math.round((l.weight_current ?? 0) * 8)
          }
          linkDirectionalParticleWidth={1.5}
          nodeLabel={(n) =>
            `${n.label} (${n.type === "shade" ? ui.shadeType : ui.emotionType}) · ${getIntensityLevel(n.intensity, ui.intensity)}`
          }
          onNodeClick={(node) => setSelectedNode(node)}
        />
      </section>
    </main>
  );
}
