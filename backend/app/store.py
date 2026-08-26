from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any

from .schemas import (
    EdgeModel,
    EdgeWeightModel,
    EdgeSeriesPoint,
    GraphModel,
    GraphResponse,
    GraphResponseEdge,
    GraphResponseNode,
    NodeDetailResponse,
)


class GraphStore:
    def __init__(self, data_path: Path) -> None:
        self._data_path = data_path
        self._lock = Lock()
        self._graph = self._load()

    def _load(self) -> GraphModel:
        with self._data_path.open("r", encoding="utf-8-sig") as f:
            payload = json.load(f)
        normalized_payload = self._normalize_payload(payload)
        graph = GraphModel.model_validate(normalized_payload)
        self._validate_consistency(graph)
        return graph

    def _normalize_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        nodes_raw = payload.get("nodes", [])
        default_meta = {"schema_version": "0.2.0", "default_lang": "es"}

        normalized_nodes: list[dict[str, Any]] = []
        for node in nodes_raw:
            if "labels" in node and "descriptions" in node:
                normalized_nodes.append(node)
                continue

            normalized_nodes.append(
                {
                    "id": node["id"],
                    "type": node["type"],
                    "parent": node.get("parent"),
                    "mx_weight": node.get("mx_weight"),
                    "labels": {
                        "en": node.get("label_en", ""),
                        "es": node.get("label_es", ""),
                    },
                    "descriptions": {
                        "en": node.get("desc_en", ""),
                        "es": node.get("desc_es", ""),
                    },
                }
            )

        if isinstance(payload.get("edges"), list):
            normalized_edges = payload["edges"]
        else:
            current_week = self._current_week()
            now_iso = datetime.now(tz=UTC).isoformat()
            normalized_edges = []
            for node in normalized_nodes:
                if node.get("type") != "shade" or not node.get("parent"):
                    continue

                seeded_weight = self._seed_weight_from_mx(node.get("mx_weight"))
                weights = (
                    [{"week": current_week, "value": seeded_weight}]
                    if seeded_weight is not None
                    else []
                )

                normalized_edges.append(
                    {
                        "id": f"e_{node['id']}_{node['parent']}",
                        "source": node["id"],
                        "target": node["parent"],
                        "relation": "belongs_to",
                        "weights": weights,
                        "updated_at": now_iso,
                    }
                )

        return {
            "meta": payload.get("meta", default_meta),
            "nodes": normalized_nodes,
            "edges": normalized_edges,
        }

    @staticmethod
    def _current_week() -> str:
        iso = datetime.now(tz=UTC).isocalendar()
        return f"{iso.year}-W{iso.week:02d}"

    @staticmethod
    def _seed_weight_from_mx(mx_weight: str | None) -> float | None:
        mapping = {
            "alto": 0.8,
            "medio": 0.55,
            "pendiente": None,
        }
        return mapping.get(mx_weight)

    def _save(self) -> None:
        with self._data_path.open("w", encoding="utf-8") as f:
            json.dump(self._graph.model_dump(mode="json"), f, ensure_ascii=False, indent=2)

    def _validate_consistency(self, graph: GraphModel) -> None:
        node_ids = {n.id for n in graph.nodes}
        core_ids = {n.id for n in graph.nodes if n.type == "core"}

        for node in graph.nodes:
            if node.type == "core" and node.parent is not None:
                raise ValueError(f"Core node {node.id} cannot have parent")
            if node.type == "shade":
                if node.parent is None or node.parent not in core_ids:
                    raise ValueError(f"Shade node {node.id} must point to core parent")

        for edge in graph.edges:
            if edge.source not in node_ids or edge.target not in node_ids:
                raise ValueError(f"Edge {edge.id} points to unknown node")
            source_node = next(n for n in graph.nodes if n.id == edge.source)
            target_node = next(n for n in graph.nodes if n.id == edge.target)
            if source_node.type != "shade" or target_node.type != "core":
                raise ValueError(f"Edge {edge.id} must connect shade -> core")

    def get_graph(self, lang: str, week: str | None) -> GraphResponse:
        with self._lock:
            nodes = [
                GraphResponseNode(
                    id=n.id,
                    type=n.type,
                    parent=n.parent,
                    mx_weight=n.mx_weight,
                    label=n.labels.es if lang == "es" else n.labels.en,
                    description=n.descriptions.es if lang == "es" else n.descriptions.en,
                )
                for n in self._graph.nodes
            ]

            edges = [
                GraphResponseEdge(
                    id=e.id,
                    source=e.source,
                    target=e.target,
                    relation=e.relation,
                    weight_current=self._weight_for_week(e, week),
                )
                for e in self._graph.edges
            ]

            return GraphResponse(
                meta=self._graph.meta,
                lang=lang,
                week=week,
                nodes=nodes,
                edges=edges,
            )

    def get_node_detail(self, node_id: str, lang: str, week: str | None) -> NodeDetailResponse:
        with self._lock:
            node_map = {n.id: n for n in self._graph.nodes}
            if node_id not in node_map:
                raise KeyError(node_id)

            current = node_map[node_id]
            node_out = GraphResponseNode(
                id=current.id,
                type=current.type,
                parent=current.parent,
                mx_weight=current.mx_weight,
                label=current.labels.es if lang == "es" else current.labels.en,
                description=current.descriptions.es if lang == "es" else current.descriptions.en,
            )

            related_edges = [
                e for e in self._graph.edges if e.source == node_id or e.target == node_id
            ]

            neighbor_ids = set()
            for edge in related_edges:
                neighbor_ids.add(edge.source)
                neighbor_ids.add(edge.target)
            neighbor_ids.discard(node_id)

            neighbors = []
            for nid in neighbor_ids:
                n = node_map[nid]
                neighbors.append(
                    GraphResponseNode(
                        id=n.id,
                        type=n.type,
                        parent=n.parent,
                        mx_weight=n.mx_weight,
                        label=n.labels.es if lang == "es" else n.labels.en,
                        description=n.descriptions.es if lang == "es" else n.descriptions.en,
                    )
                )

            edge_out = [
                GraphResponseEdge(
                    id=e.id,
                    source=e.source,
                    target=e.target,
                    relation=e.relation,
                    weight_current=self._weight_for_week(e, week),
                )
                for e in related_edges
            ]

            return NodeDetailResponse(node=node_out, neighbors=neighbors, edges=edge_out)

    def update_edge_weight(self, edge_id: str, week: str, value: float) -> tuple[str, str, float, datetime]:
        with self._lock:
            edge = next((e for e in self._graph.edges if e.id == edge_id), None)
            if edge is None:
                raise KeyError(edge_id)

            existing = next((w for w in edge.weights if w.week == week), None)
            if existing is None:
                edge.weights.append(EdgeWeightModel(week=week, value=value))
            else:
                existing.value = value

            edge.updated_at = datetime.now(tz=UTC)
            self._save()
            return edge.id, week, value, edge.updated_at

    def edge_series(self, edge_id: str, week_from: str | None, week_to: str | None) -> list[EdgeSeriesPoint]:
        with self._lock:
            edge = next((e for e in self._graph.edges if e.id == edge_id), None)
            if edge is None:
                raise KeyError(edge_id)

            points = sorted(edge.weights, key=lambda x: x.week)
            if week_from is not None:
                points = [p for p in points if p.week >= week_from]
            if week_to is not None:
                points = [p for p in points if p.week <= week_to]

            return [EdgeSeriesPoint(week=p.week, value=p.value) for p in points]

    @staticmethod
    def _weight_for_week(edge: EdgeModel, week: str | None) -> float | None:
        if week is None:
            if not edge.weights:
                return None
            latest = sorted(edge.weights, key=lambda x: x.week)[-1]
            return latest.value
        point = next((w for w in edge.weights if w.week == week), None)
        return None if point is None else point.value
