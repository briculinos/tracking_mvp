from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import anthropic

from app.config import get_settings

router = APIRouter()


class InsightsRequest(BaseModel):
    mode: str  # 'tracks' or 'dwell'
    store_id: int
    floor: int
    start_date: str
    end_date: str
    start_hour: int
    end_hour: int
    # Tracks mode data
    total_rendered: Optional[int] = None
    total_in_database: Optional[int] = None
    # Dwell mode data
    total_dwell_time: Optional[int] = None
    avg_dwell_time: Optional[float] = None
    active_cells: Optional[int] = None
    # Zone data
    zones_count: Optional[int] = None


class InsightsResponse(BaseModel):
    analysis: str
    alarms: list[str]
    actions: list[str]


@router.post("/generate")
async def generate_insights(request: InsightsRequest) -> InsightsResponse:
    """Generate AI insights based on heatmap/dwell data."""
    settings = get_settings()

    if not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    # Store mapping for context
    store_names = {
        445: "IKEA Malmö, Sweden"
    }
    store_name = store_names.get(request.store_id, f"IKEA Store {request.store_id}")

    # System prompt for retail intelligence analyst role
    system_prompt = """You are a senior retail intelligence analyst specialized in large-format IKEA stores.
You understand customer flow psychology, forced vs voluntary behavior, layout intent vs actual usage, and how movement and dwell translate into conversion, friction, and operational cost.

You are aware that tracking data is often sampled, noisy, and influenced by store constraints.
Your task is to extract robust signals, identify risks, and propose concrete, testable actions.

GLOBAL CONSTRAINTS (IMPORTANT):
- Do not over-interpret sampling noise
- Prefer structural patterns over exact numbers
- Avoid generic retail advice
- Do not restate what is visually obvious
- Every recommendation must be intentional, testable, and measurable"""

    # Build context and task based on mode
    if request.mode == 'tracks':
        total_db = request.total_in_database or 0
        total_rendered = request.total_rendered or 0
        prompt = f"""INPUT — TRACKS (Movement Density)

Context:
- Store: {store_name} (ID: {request.store_id})
- Floor: {request.floor}
- Date range: {request.start_date} → {request.end_date}
- Time window: {request.start_hour}:00 to {request.end_hour}:00
- Total tracking points in database: {total_db:,}
- Points rendered / sampled: {total_rendered:,}
- Zones defined: {request.zones_count or 0}
- Visualization represents relative movement density, not absolute counts

Sampling note:
The rendered data is a spatially representative sample.
Insights should focus on persistent spatial patterns, not fine-grained intensity differences.

TASK — TRACKS

Analyze the movement density heatmap to understand how customers actually navigate the store.

You must:
1. Identify dominant flow structures (primary paths, loops, shortcuts)
2. Separate structural signals from sampling noise
3. Detect anomalies, risks, or inefficiencies in flow
4. Translate insights into intentional store actions

OUTPUT FORMAT — TRACKS (STRICT)

ANALYSIS
Summarize in 3–4 sentences how customers move through the store in practice, highlighting:
- where flow aligns with expected IKEA journey
- where it diverges or collapses into pass-through behavior

ALARMS
List 2–3 issues, each framed as a retail risk or missed opportunity, for example:
- congestion zones reducing exposure time
- high-traffic / low-engagement corridors
- areas effectively bypassed by customers

ACTIONS
Provide 3 actions, each explicit and intentional:
- What should change (layout, assortment, signage, staffing, barriers)
- Where (specific zone or path type)
- Why (expected behavioral or commercial impact)

Actions must be feasible inside a live IKEA store and suitable for A/B testing."""

    else:  # dwell mode
        total_dwell = request.total_dwell_time or 0
        avg_dwell = request.avg_dwell_time or 0
        active_cells = request.active_cells or 0
        prompt = f"""INPUT — DWELL (Time Spent / Engagement)

Context:
- Store: {store_name} (ID: {request.store_id})
- Floor: {request.floor}
- Date range: {request.start_date} → {request.end_date}
- Time window: {request.start_hour}:00 to {request.end_hour}:00
- Total dwell time recorded: {total_dwell:,} seconds ({total_dwell / 3600:.1f} hours)
- Average dwell per active cell: {avg_dwell:.1f} seconds
- Active dwell cells: {active_cells:,}
- Zones defined: {request.zones_count or 0}
- Visualization shows relative dwell intensity

Note:
High dwell does not automatically equal high engagement.
Your analysis must distinguish intentional dwell from forced dwell.

TASK — DWELL

Interpret where customers stop, hesitate, or engage, and what that implies for conversion and friction.

You must:
1. Classify dwell patterns (engagement vs confusion vs congestion)
2. Identify high-dwell / low-flow and low-dwell / high-flow mismatches
3. Flag unexpected dwell anomalies
4. Recommend actions that improve clarity, engagement, or throughput

OUTPUT FORMAT — DWELL (STRICT)

ANALYSIS
Explain in 3–4 sentences what the dwell distribution reveals about customer decision-making and engagement across the store.

ALARMS
List 2–3 dwell-related issues, focusing on:
- prolonged dwell without commercial intent
- disengagement in expected inspiration zones
- dwell accumulation caused by layout or information friction

ACTIONS
Provide 3 targeted actions, each specifying:
- What intervention to apply
- Where (zone type or store function)
- Why it should improve engagement, conversion, or flow efficiency"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            system=system_prompt,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        response_text = message.content[0].text

        # Parse the response into sections
        analysis = ""
        alarms = []
        actions = []

        # Extract ANALYSIS section
        if "ANALYSIS" in response_text:
            analysis_start = response_text.find("ANALYSIS")
            analysis_end = response_text.find("ALARMS")
            if analysis_end == -1:
                analysis_end = len(response_text)
            analysis = response_text[analysis_start:analysis_end].replace("ANALYSIS", "").strip()
            # Clean up any leading colons or newlines
            analysis = analysis.lstrip(":").lstrip("\n").strip()

        # Extract ALARMS section
        if "ALARMS" in response_text:
            alarms_start = response_text.find("ALARMS")
            alarms_end = response_text.find("ACTIONS")
            if alarms_end == -1:
                alarms_end = len(response_text)
            alarms_text = response_text[alarms_start:alarms_end].replace("ALARMS", "").strip()
            alarms_text = alarms_text.lstrip(":").lstrip("\n").strip()
            alarms = [
                line.strip().lstrip("- ").lstrip("• ").lstrip("1.").lstrip("2.").lstrip("3.").strip()
                for line in alarms_text.split("\n")
                if line.strip() and not line.strip().startswith("List") and len(line.strip()) > 3
            ]

        # Extract ACTIONS section
        if "ACTIONS" in response_text:
            actions_start = response_text.find("ACTIONS")
            actions_text = response_text[actions_start:].replace("ACTIONS", "").strip()
            actions_text = actions_text.lstrip(":").lstrip("\n").strip()
            actions = [
                line.strip().lstrip("- ").lstrip("• ").lstrip("1.").lstrip("2.").lstrip("3.").strip()
                for line in actions_text.split("\n")
                if line.strip() and not line.strip().startswith("Provide") and len(line.strip()) > 3
            ]

        return InsightsResponse(
            analysis=analysis or "Unable to generate analysis.",
            alarms=alarms[:3],
            actions=actions[:3]
        )

    except anthropic.APIError as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")
