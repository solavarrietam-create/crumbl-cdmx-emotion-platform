from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class MetaModel(BaseModel):
    schema_version: str
    default_lang: Literal["es", "en"]


class LabelsModel(BaseModel):
    es: str
    en: str


class DescriptionsModel(BaseModel):
    es: str
    en: str


class NodeModel(BaseModel):
    id: str
    type: Literal["core", "shade"]
    parent: str | None
    mx_weight: Literal["alto", "medio", "pendiente"] | None = None
    labels: LabelsModel
    descriptions: DescriptionsModel


class EdgeWeightModel(BaseModel):
    week: str = Field(pattern=r"^\d{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$")
    value: float = Field(ge=0, le=1)


class EdgeModel(BaseModel):
    id: str
    source: str
    target: str
    relation: Literal["belongs_to"]
    weights: list[EdgeWeightModel]
    updated_at: datetime


class GraphModel(BaseModel):
    meta: MetaModel
    nodes: list[NodeModel]
    edges: list[EdgeModel]


class WeightUpdateRequest(BaseModel):
    value: float = Field(ge=0, le=1)
    actor: str | None = None
    source: str | None = None


class GraphResponseNode(BaseModel):
    id: str
    type: Literal["core", "shade"]
    parent: str | None
    mx_weight: Literal["alto", "medio", "pendiente"] | None = None
    label: str
    description: str


class GraphResponseEdge(BaseModel):
    id: str
    source: str
    target: str
    relation: Literal["belongs_to"]
    weight_current: float | None


class GraphResponse(BaseModel):
    meta: MetaModel
    lang: Literal["es", "en"]
    week: str | None
    nodes: list[GraphResponseNode]
    edges: list[GraphResponseEdge]


class NodeDetailResponse(BaseModel):
    node: GraphResponseNode
    neighbors: list[GraphResponseNode]
    edges: list[GraphResponseEdge]


class EdgeSeriesPoint(BaseModel):
    week: str
    value: float


class EdgeSeriesResponse(BaseModel):
    edge_id: str
    points: list[EdgeSeriesPoint]


class WeightUpdateResponse(BaseModel):
    edge_id: str
    week: str
    value: float
    updated_at: datetime


class ReadingActivationModel(BaseModel):
    shade_id: str
    weight: float = Field(ge=0, le=1)
    confidence: Literal["low", "medium", "high"]
    evidence: str


class ReadingRelationModel(BaseModel):
    from_shade_id: str
    to_shade_id: str
    relation: str
    weight: float = Field(ge=0, le=1)
    evidence: str


class ReadingDimensionModel(BaseModel):
    id: str
    label: str
    description: str
    intensity: float = Field(ge=0, le=1)
    driver_shades: list[str]


class ReadingResponse(BaseModel):
    reading_id: str
    week: str
    source: str
    title: str
    notes: str
    activations: list[ReadingActivationModel]
    relations: list[ReadingRelationModel] = []
    dimensions: list[ReadingDimensionModel] = []
