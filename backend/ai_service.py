import os
import json
import logging
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from typing import Dict, Any

load_dotenv()
logger = logging.getLogger(__name__)

EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')

async def generate_business_insights(stats: Dict[str, Any]) -> str:
    """Generate AI insights for business dashboard"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id="sp-ai-insights",
            system_message="You are a business intelligence analyst providing actionable insights for SP Group industrial operations."
        ).with_model("openai", "gpt-4o-mini")

        prompt = f"""Analyze this business data and provide 3-4 concise, actionable insights as bullet points.

Data:
- Total Users: {stats.get('total_users', 0)}
- Total Tasks: {stats.get('total_tasks', 0)}
- Pending Tasks: {stats.get('pending_tasks', 0)}
- Total Reports: {stats.get('total_reports', 0)}
- Pending Indents: {stats.get('pending_indents', 0)}

Business Performance:
{json.dumps(stats.get('business_stats', [])[:3], indent=2)}

Focus on: operational efficiency, resource utilization, areas needing attention.
Keep each bullet under 20 words. Use bullet symbol."""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        logger.info("Generated AI insights successfully")
        return response

    except Exception as e:
        logger.error(f"Failed to generate insights: {str(e)}")
        return "• Focus on completing pending tasks to improve operational efficiency\n• Monitor pending indents to ensure smooth supply chain operations\n• Regular reporting indicates good operational discipline"

async def categorize_expense(description: str) -> str:
    """Auto-categorize expense based on description using AI"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id="sp-expense-categorize",
            system_message="You are an accounting assistant. Categorize expenses into: Salary, Raw Materials, Utilities, Fuel, Maintenance, Transportation, Office Supplies, Marketing, Other. Return ONLY the category name."
        ).with_model("openai", "gpt-4o-mini")

        user_message = UserMessage(text=f"Categorize this expense: {description}")
        response = await chat.send_message(user_message)
        return response.strip()

    except Exception as e:
        logger.error(f"Failed to categorize expense: {str(e)}")
        return "Other"
