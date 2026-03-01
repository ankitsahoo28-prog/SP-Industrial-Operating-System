import os
import json
import logging
from openai import OpenAI
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

async def generate_business_insights(stats: Dict[str, Any]) -> str:
    """Generate AI insights for business dashboard"""
    try:
        prompt = f"""
You are a business analyst for SP Industrial Operating System. Analyze the following business data and provide 3-4 concise, actionable insights in bullet points.

Data:
- Total Users: {stats.get('total_users', 0)}
- Total Tasks: {stats.get('total_tasks', 0)}
- Pending Tasks: {stats.get('pending_tasks', 0)}
- Total Reports: {stats.get('total_reports', 0)}
- Pending Indents: {stats.get('pending_indents', 0)}

Business Performance (if available):
{json.dumps(stats.get('business_stats', [])[:3], indent=2)}

Provide insights on:
1. Operational efficiency
2. Resource utilization
3. Areas needing attention
4. Growth opportunities

Keep it brief and actionable (max 4 bullet points, 20 words each).
"""
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a business intelligence analyst providing actionable insights."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=300,
            temperature=0.7
        )
        
        insights = response.choices[0].message.content.strip()
        logger.info("Generated AI insights successfully")
        return insights
        
    except Exception as e:
        logger.error(f"Failed to generate insights: {str(e)}")
        return "• Focus on completing pending tasks to improve operational efficiency\n• Monitor pending indents to ensure smooth supply chain operations\n• Regular reporting indicates good operational discipline"

async def categorize_expense(description: str) -> str:
    """Auto-categorize expense based on description using AI"""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an accounting assistant. Categorize the expense into one of these categories: Salary, Raw Materials, Utilities, Fuel, Maintenance, Transportation, Office Supplies, Marketing, Other. Return ONLY the category name."},
                {"role": "user", "content": f"Categorize this expense: {description}"}
            ],
            max_tokens=10,
            temperature=0.3
        )
        category = response.choices[0].message.content.strip()
        return category
    except Exception as e:
        logger.error(f"Failed to categorize expense: {str(e)}")
        return "Other"