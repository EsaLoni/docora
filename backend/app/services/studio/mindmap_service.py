"""Mind Map & Knowledge Graph Generation Engine.

Extracts key concepts, hierarchical taxonomy, and cross-source connections
from notebook documents for interactive graph visualization.
"""

import time
from typing import Any, Dict, List, Optional
import uuid

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.studio.base import BaseStudioService

logger = get_logger("studio.mindmap")

MINDMAP_SYSTEM_PROMPT = """You are a knowledge graph architect.
Analyze the provided document sources and construct an organized, hierarchical knowledge graph / mind map.

RULES:
1. Identify 1 Central Theme (root node).
2. Identify 3-6 Major Core Branches (primary concepts).
3. Connect 2-4 Sub-topics or key facts to each core branch.
4. Define clear, labeled relationships on edges (e.g., "contains", "requires", "impacts", "governed by").
5. Keep node descriptions concise (under 15 words) and punchy.
6. Add source citations where applicable.

Output Schema:
{
  "root_title": "string",
  "nodes": [
    {
      "id": "node-root",
      "label": "Central Subject",
      "category": "root",
      "description": "Core theme...",
      "citation": null
    },
    {
      "id": "node-1",
      "label": "Core Category A",
      "category": "primary",
      "description": "Details...",
      "citation": "Source 1"
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-root",
      "target": "node-1",
      "label": "consists of"
    }
  ]
}
"""


class MindMapService(BaseStudioService):
    """Generates concept nodes and relationship edges for interactive mind maps."""

    async def generate_mindmap(
        self,
        sources_data: List[Dict[str, Any]],
        topic_focus: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate structured knowledge graph via Gemini."""
        start_time = time.time()
        context_text = self.format_sources_context(sources_data)

        user_prompt = (
            "Construct a comprehensive, multi-branch concept mind map from the provided document evidence.\n"
        )
        if topic_focus:
            user_prompt += f"Central Theme Focus: {topic_focus}\n\n"
        user_prompt += f"SOURCE MATERIALS:\n{context_text}"

        data = await self.generate_json(
            system_instruction=MINDMAP_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.2,
        )

        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        nodes = data.get("nodes", [])
        edges = data.get("edges", [])

        return {
            "title": data.get("root_title", "Knowledge Mind Map"),
            "root_title": data.get("root_title", "Central Theme"),
            "node_count": len(nodes),
            "edge_count": len(edges),
            "nodes": nodes,
            "edges": edges,
            "generation_time_ms": elapsed_ms,
        }
