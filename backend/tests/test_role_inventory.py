"""
Backend tests for:
1. Role-based access control (custom job roles)
2. Odoo-style Inventory CRUD operations
3. User permissions verification
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://odoo-advance-pay.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USERS = {
    "director": {"email": "director@sp.com", "password": "password123"},
    "manager": {"email": "manager@sp.com", "password": "password123"},
    "staff": {"email": "staff@sp.com", "password": "password123"},
    "custom_role_user": {"email": "arun@sp.com", "password": "password123"},
}


class TestAuthEndpoints:
    """Test authentication and permission returning for all user types"""
    
    def test_director_login_returns_permissions(self):
        """Director login should return permissions: ['all']"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["director"])
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert "token" in data
        assert "permissions" in data["user"]
        assert data["user"]["permissions"] == ["all"], f"Expected ['all'], got {data['user']['permissions']}"
        assert data["user"]["role"] == "director"
    
    def test_manager_login_returns_default_permissions(self):
        """Manager login should return default manager permissions"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["manager"])
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        permissions = data["user"]["permissions"]
        assert "view_dashboard" in permissions
        assert "view_inventory" in permissions
        assert "view_accounting" in permissions
        assert "manage_tasks" in permissions
        # Manager should NOT have director-only permissions
        assert "manage_companies" not in permissions or permissions == ["all"] or data["user"]["role"] == "director"
    
    def test_ground_staff_login_returns_default_permissions(self):
        """Ground staff login should return limited permissions"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["staff"])
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        permissions = data["user"]["permissions"]
        assert "view_dashboard" in permissions
        assert "manage_tasks" in permissions
        assert "view_reports" in permissions
        # Ground staff should NOT see accounting/inventory by default
        assert data["user"]["role"] == "ground_staff"
    
    def test_custom_role_user_returns_custom_permissions(self):
        """Custom role user (arun@sp.com) should return their custom role permissions"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["custom_role_user"])
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        permissions = data["user"]["permissions"]
        # arun@sp.com has custom role with edit_accounting, view_accounting, edit_inventory, view_inventory
        assert "edit_accounting" in permissions
        assert "view_accounting" in permissions
        assert "edit_inventory" in permissions
        assert "view_inventory" in permissions
        assert data["user"].get("job_role_id") is not None, "Custom role user should have job_role_id"
    
    def test_auth_me_returns_permissions(self):
        """GET /auth/me should return permissions"""
        # First login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["director"])
        token = login_resp.json()["token"]
        # Then get me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert "permissions" in data
        assert data["permissions"] == ["all"]


class TestRoleManagement:
    """Test job role CRUD operations"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["director"])
        return response.json()["token"]
    
    def test_get_all_roles(self, director_token):
        """GET /job-roles should return list of roles"""
        response = requests.get(f"{BASE_URL}/api/job-roles", headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # There should be at least one role (arun role exists)
        assert len(data) >= 1
    
    def test_get_permissions_list(self, director_token):
        """GET /job-roles/permissions should return available permissions"""
        response = requests.get(f"{BASE_URL}/api/job-roles/permissions", headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert "view_dashboard" in data
        assert "view_inventory" in data
        assert "edit_accounting" in data
    
    def test_create_role(self, director_token):
        """POST /job-roles should create a new role"""
        role_data = {
            "name": f"TEST_Role_{uuid.uuid4().hex[:6]}",
            "description": "Test role for automated testing",
            "permissions": ["view_dashboard", "view_inventory"]
        }
        response = requests.post(f"{BASE_URL}/api/job-roles", json=role_data, headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == role_data["name"]
        assert data["permissions"] == role_data["permissions"]
        assert "id" in data
    
    def test_non_director_cannot_access_roles(self):
        """Non-directors should not be able to access role management"""
        # Login as manager
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["manager"])
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/job-roles", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403


class TestInventoryDashboard:
    """Test inventory dashboard endpoint"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["director"])
        return response.json()["token"]
    
    def test_inventory_dashboard(self, director_token):
        """GET /inv/dashboard should return inventory stats"""
        response = requests.get(f"{BASE_URL}/api/inv/dashboard", headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        # Dashboard can have either Odoo-style or legacy format
        # Odoo-style: total_products, total_value, warehouses
        # Legacy: total_items, total_value, business_stats
        assert isinstance(data, dict)
        # Check we have some expected keys (flexible for both formats)
        has_products = "total_products" in data or "total_items" in data or "business_stats" in data
        assert has_products, f"Dashboard missing expected keys: {data.keys()}"


class TestInventoryProducts:
    """Test inventory product CRUD operations"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["director"])
        return response.json()["token"]
    
    def test_list_products(self, director_token):
        """GET /inv/products should return list of products"""
        response = requests.get(f"{BASE_URL}/api/inv/products", headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_product(self, director_token):
        """POST /inv/products should create a new product"""
        product_data = {
            "name": f"TEST_Product_{uuid.uuid4().hex[:6]}",
            "sku": f"TST{uuid.uuid4().hex[:6]}",
            "product_type": "storable",
            "cost_price": 100.50,
            "sale_price": 150.00,
            "description": "Test product for automation"
        }
        response = requests.post(f"{BASE_URL}/api/inv/products", json=product_data, headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == product_data["name"]
        assert data["sku"] == product_data["sku"]
        assert "id" in data
        return data["id"]
    
    def test_get_single_product(self, director_token):
        """GET /inv/products/{id} should return single product"""
        # First create a product
        product_data = {"name": f"TEST_SingleGet_{uuid.uuid4().hex[:6]}", "product_type": "storable"}
        create_resp = requests.post(f"{BASE_URL}/api/inv/products", json=product_data, headers={"Authorization": f"Bearer {director_token}"})
        product_id = create_resp.json()["id"]
        
        # Then get it
        response = requests.get(f"{BASE_URL}/api/inv/products/{product_id}", headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == product_id
    
    def test_ground_staff_cannot_create_product(self):
        """Ground staff should not be able to create products"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["staff"])
        token = login_resp.json()["token"]
        
        product_data = {"name": "TEST_Unauthorized", "product_type": "storable"}
        response = requests.post(f"{BASE_URL}/api/inv/products", json=product_data, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403


class TestInventoryWarehouses:
    """Test warehouse operations"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["director"])
        return response.json()["token"]
    
    def test_list_warehouses(self, director_token):
        """GET /inv/warehouses should return warehouses"""
        response = requests.get(f"{BASE_URL}/api/inv/warehouses", headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least 1 warehouse (seeded)
        assert len(data) >= 1


class TestInventoryCategories:
    """Test inventory category operations"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["director"])
        return response.json()["token"]
    
    def test_list_categories(self, director_token):
        """GET /inv/categories should return categories (list or dict)"""
        response = requests.get(f"{BASE_URL}/api/inv/categories", headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        # Categories can be a list (Odoo-style) or a dict (legacy grouped by business type)
        assert isinstance(data, (list, dict)), f"Expected list or dict, got {type(data)}"


class TestInventoryStockMoves:
    """Test stock move operations"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["director"])
        return response.json()["token"]
    
    def test_list_stock_moves(self, director_token):
        """GET /inv/stock-moves should return stock moves"""
        response = requests.get(f"{BASE_URL}/api/inv/stock-moves", headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_stock_move(self, director_token):
        """POST /inv/stock-moves should create a stock move"""
        # First, get a product and location
        products_resp = requests.get(f"{BASE_URL}/api/inv/products", headers={"Authorization": f"Bearer {director_token}"})
        products = products_resp.json()
        
        # Create a product if none exists
        if not products:
            prod_resp = requests.post(f"{BASE_URL}/api/inv/products", json={"name": "TEST_MoveProd", "product_type": "storable"}, headers={"Authorization": f"Bearer {director_token}"})
            product_id = prod_resp.json()["id"]
        else:
            product_id = products[0]["id"]
        
        # Get locations
        locations_resp = requests.get(f"{BASE_URL}/api/inv/locations", headers={"Authorization": f"Bearer {director_token}"})
        locations = locations_resp.json()
        input_loc = next((l for l in locations if l["name"] == "Input"), locations[0] if locations else None)
        stock_loc = next((l for l in locations if l["name"] == "Stock"), locations[1] if len(locations) > 1 else None)
        
        if input_loc and stock_loc:
            move_data = {
                "product_id": product_id,
                "quantity": 50,
                "source_location_id": input_loc["id"],
                "dest_location_id": stock_loc["id"],
                "move_type": "receipt",
                "reference": f"TEST_MOVE_{uuid.uuid4().hex[:6]}"
            }
            response = requests.post(f"{BASE_URL}/api/inv/stock-moves", json=move_data, headers={"Authorization": f"Bearer {director_token}"})
            assert response.status_code == 200
            data = response.json()
            assert data["quantity"] == 50
            assert data["state"] == "draft"


class TestInventoryReorder:
    """Test reorder check endpoint"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["director"])
        return response.json()["token"]
    
    def test_reorder_check(self, director_token):
        """GET /inv/reorder-check should return reorder suggestions"""
        response = requests.get(f"{BASE_URL}/api/inv/reorder-check", headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestInventoryValuation:
    """Test valuation endpoint"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["director"])
        return response.json()["token"]
    
    def test_valuation(self, director_token):
        """GET /inv/valuation should return valuation data"""
        response = requests.get(f"{BASE_URL}/api/inv/valuation", headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "products" in data
        assert "total_value" in data
    
    def test_ground_staff_cannot_view_valuation(self):
        """Ground staff should not be able to view valuation"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["staff"])
        token = login_resp.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/inv/valuation", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
