"""
Backend tests for AI Accounting Features (7 endpoints)
Tests cover: AI Chat, Invoice Extract, Categorize, Reconcile, Financial Q&A, Cash Forecast, Anomaly Detection
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for director user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "director@sp.com", "password": "password123"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestAiChat:
    """AI Chat Assistant tests - POST /api/acc/ai/chat"""

    def test_chat_journal_entry_suggestion(self, api_client):
        """Test that AI suggests journal entry for accounting transaction"""
        response = api_client.post(
            f"{BASE_URL}/api/acc/ai/chat",
            json={"message": "Record rent payment of 25000 from bank", "auto_post": False},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify AI response structure
        assert "response_text" in data
        assert "action_type" in data
        assert data["action_type"] == "journal_entry"
        assert "journal_entry" in data
        
        # Verify journal entry has balanced lines
        je = data["journal_entry"]
        assert "lines" in je
        assert len(je["lines"]) >= 2
        
        total_debit = sum(l.get("debit", 0) for l in je["lines"])
        total_credit = sum(l.get("credit", 0) for l in je["lines"])
        assert abs(total_debit - total_credit) < 0.01, "Entry should be balanced"
        
        assert data["executed"] == False  # auto_post was False

    def test_chat_with_auto_post(self, api_client):
        """Test that auto_post creates and posts journal entry"""
        response = api_client.post(
            f"{BASE_URL}/api/acc/ai/chat",
            json={"message": "TEST_AI Miscellaneous expense of 500 paid in cash", "auto_post": True},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "executed" in data
        if data["executed"]:
            assert "move_id" in data
            assert "created and posted" in data["response_text"].lower() or "executed" in str(data).lower()
        # If execution_error occurs, it should be documented
        if "execution_error" in data:
            pytest.fail(f"Auto-post failed: {data['execution_error']}")

    def test_chat_question_answering(self, api_client):
        """Test that AI can answer accounting questions"""
        response = api_client.post(
            f"{BASE_URL}/api/acc/ai/chat",
            json={"message": "What accounts should I use for salary payment?", "auto_post": False},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "response_text" in data
        assert data["action_type"] in ["info", "journal_entry", "clarification"]


class TestInvoiceExtract:
    """AI Invoice Data Extraction tests - POST /api/acc/ai/invoice-extract"""

    def test_invoice_extraction(self, api_client):
        """Test invoice data extraction from natural language"""
        response = api_client.post(
            f"{BASE_URL}/api/acc/ai/invoice-extract",
            json={"description": "Invoice from ABC Suppliers for 50 bags of cement at 350 each plus 18% GST"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify extraction structure
        assert "move_type" in data
        assert data["move_type"] in ["in_invoice", "out_invoice"]
        assert "partner_name" in data
        assert "invoice_lines" in data
        assert len(data["invoice_lines"]) > 0
        
        # Verify line items
        line = data["invoice_lines"][0]
        assert "product_name" in line
        assert "quantity" in line
        assert "unit_price" in line
        
        # Verify confidence
        assert "confidence" in data
        assert data["confidence"] >= 0.5

    def test_invoice_extraction_with_tax(self, api_client):
        """Test invoice extraction captures tax information"""
        response = api_client.post(
            f"{BASE_URL}/api/acc/ai/invoice-extract",
            json={"description": "Bill from Tech Corp for 10 laptops at 45000 each with 28% GST"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "tax_info" in data
        assert "GST" in data["tax_info"] or "28" in str(data.get("tax_info", ""))


class TestCategorize:
    """AI Transaction Categorization tests - POST /api/acc/ai/categorize"""

    def test_categorize_expense(self, api_client):
        """Test categorization of expense transaction"""
        response = api_client.post(
            f"{BASE_URL}/api/acc/ai/categorize",
            json={"description": "Office supplies", "amount": 5000},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify categorization structure
        assert "debit_account" in data
        assert "credit_account" in data
        assert "category" in data
        assert "confidence" in data
        
        # Verify account suggestions
        assert "code" in data["debit_account"]
        assert "name" in data["debit_account"]
        assert "code" in data["credit_account"]
        assert "name" in data["credit_account"]
        
        # Verify category type
        assert data["category"] in ["expense", "revenue", "asset", "liability", "transfer"]

    def test_categorize_revenue(self, api_client):
        """Test categorization of revenue transaction"""
        response = api_client.post(
            f"{BASE_URL}/api/acc/ai/categorize",
            json={"description": "Sales of product to customer", "amount": 25000},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["confidence"] >= 0.5


class TestReconcileSuggest:
    """AI Reconciliation Suggestions tests - POST /api/acc/ai/reconcile-suggest"""

    def test_reconciliation_suggestions(self, api_client):
        """Test AI provides reconciliation suggestions"""
        response = api_client.post(
            f"{BASE_URL}/api/acc/ai/reconcile-suggest",
            json={},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "suggestions" in data or "summary" in data or "message" in data
        
        if data.get("suggestions"):
            for suggestion in data["suggestions"]:
                assert "match_type" in suggestion or "reason" in suggestion


class TestFinancialQA:
    """AI Financial Q&A tests - POST /api/acc/ai/financial-qa"""

    def test_financial_question(self, api_client):
        """Test AI answers financial questions"""
        response = api_client.post(
            f"{BASE_URL}/api/acc/ai/financial-qa",
            json={"question": "What is my total revenue?"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify Q&A structure
        assert "answer" in data
        assert len(data["answer"]) > 10  # Non-empty answer

    def test_financial_question_with_metrics(self, api_client):
        """Test AI provides key metrics with answer"""
        response = api_client.post(
            f"{BASE_URL}/api/acc/ai/financial-qa",
            json={"question": "Give me a summary of my expenses"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "answer" in data
        # Optional but expected fields
        if "key_metrics" in data:
            assert isinstance(data["key_metrics"], list)


class TestCashForecast:
    """AI Cash Flow Forecast tests - GET /api/acc/ai/cash-forecast"""

    def test_cash_forecast_generation(self, api_client):
        """Test AI generates cash flow forecast"""
        response = api_client.get(
            f"{BASE_URL}/api/acc/ai/cash-forecast",
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify forecast structure
        assert "current_cash" in data
        assert "forecast" in data
        assert "risk_level" in data
        
        # Verify forecast periods
        assert isinstance(data["forecast"], list)
        if data["forecast"]:
            period = data["forecast"][0]
            assert "period" in period
            assert "inflow" in period or "outflow" in period or "balance" in period
        
        # Verify risk level
        assert data["risk_level"] in ["low", "medium", "high", "unknown"]

    def test_cash_forecast_insights(self, api_client):
        """Test AI provides insights with forecast"""
        response = api_client.get(
            f"{BASE_URL}/api/acc/ai/cash-forecast",
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify insights exist
        assert "insights" in data or "recommendations" in data


class TestAnomalyDetection:
    """AI Anomaly Detection tests - GET /api/acc/ai/anomalies"""

    def test_anomaly_detection(self, api_client):
        """Test AI detects anomalies in transactions"""
        response = api_client.get(
            f"{BASE_URL}/api/acc/ai/anomalies",
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "anomalies" in data
        assert "summary" in data
        assert "health_score" in data
        
        # Verify health score is valid
        assert 0 <= data["health_score"] <= 100

    def test_anomaly_severity_levels(self, api_client):
        """Test anomalies have proper severity levels"""
        response = api_client.get(
            f"{BASE_URL}/api/acc/ai/anomalies",
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        if data.get("anomalies"):
            for anomaly in data["anomalies"]:
                if "severity" in anomaly:
                    assert anomaly["severity"] in ["high", "medium", "low"]


class TestExecutiveReportBugFix:
    """Tests for Executive Report bug fix - directorApi.getExecutiveReport"""

    def test_executive_report_endpoint(self, api_client):
        """Test /api/director/executive-report returns correct data"""
        response = api_client.get(
            f"{BASE_URL}/api/director/executive-report?period=monthly",
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "companies" in data
        assert "totals" in data
        assert "period" in data
        
        # Verify totals structure
        totals = data["totals"]
        assert "revenue" in totals
        assert "expenses" in totals
        assert "profit" in totals


class TestAccessControl:
    """Tests for AI features access control"""

    def test_ai_requires_authentication(self):
        """Test AI endpoints require authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/acc/ai/chat",
            json={"message": "Test", "auto_post": False}
        )
        assert response.status_code in [401, 403, 422], "Should reject unauthenticated request"
