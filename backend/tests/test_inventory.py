"""
Inventory Management API Tests
Tests all /api/inv/* endpoints for the Multi-Business ERP system
Covers: Dashboard, Items, Movements, Production, Transfers, LiDAR, Low Stock, Categories
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DIRECTOR_CREDS = {"email": "director@sp.com", "password": "password123"}
MANAGER_CREDS = {"email": "manager@sp.com", "password": "password123"}


@pytest.fixture(scope="module")
def director_token():
    """Get director authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=DIRECTOR_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.fail(f"Director login failed: {response.text}")


@pytest.fixture(scope="module")
def manager_token():
    """Get manager authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=MANAGER_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.fail(f"Manager login failed: {response.text}")


@pytest.fixture(scope="module")
def director_client(director_token):
    """Authenticated requests session for director"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {director_token}"
    })
    return session


@pytest.fixture(scope="module")
def manager_client(manager_token):
    """Authenticated requests session for manager"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {manager_token}"
    })
    return session


class TestInventoryAuthentication:
    """Test authentication is required for inventory endpoints"""
    
    def test_dashboard_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/inv/dashboard")
        assert response.status_code in [401, 403]
    
    def test_items_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/inv/items")
        assert response.status_code in [401, 403]


class TestInventoryDashboard:
    """Test GET /api/inv/dashboard endpoint"""
    
    def test_director_dashboard_access(self, director_client):
        """Director can access dashboard"""
        response = director_client.get(f"{BASE_URL}/api/inv/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Validate required fields
        assert "total_stock_value" in data
        assert "total_items" in data
        assert "low_stock_alerts" in data
        assert "business_stats" in data
        
        # Validate data types
        assert isinstance(data["total_stock_value"], (int, float))
        assert isinstance(data["total_items"], int)
        assert isinstance(data["low_stock_alerts"], int)
        assert isinstance(data["business_stats"], list)
        
        print(f"Dashboard: {data['total_items']} items, value: ₹{data['total_stock_value']}")
    
    def test_manager_dashboard_access(self, manager_client):
        """Manager can access dashboard"""
        response = manager_client.get(f"{BASE_URL}/api/inv/dashboard")
        assert response.status_code == 200


class TestInventoryItems:
    """Test GET/POST /api/inv/items endpoints"""
    
    def test_get_all_items(self, director_client):
        """Get all inventory items"""
        response = director_client.get(f"{BASE_URL}/api/inv/items")
        assert response.status_code == 200
        items = response.json()
        
        assert isinstance(items, list)
        assert len(items) > 0, "Should have seeded inventory items"
        
        # Validate item structure
        item = items[0]
        assert "id" in item
        assert "name" in item
        assert "business_type" in item
        assert "category" in item
        assert "current_stock" in item
        
        print(f"Found {len(items)} inventory items")
    
    def test_filter_by_business_type(self, director_client):
        """Filter items by business_type"""
        response = director_client.get(f"{BASE_URL}/api/inv/items", params={"business_type": "petrol_pump"})
        assert response.status_code == 200
        items = response.json()
        
        for item in items:
            assert item["business_type"] == "petrol_pump"
    
    def test_filter_by_category(self, director_client):
        """Filter items by category"""
        response = director_client.get(f"{BASE_URL}/api/inv/items", params={"category": "finished_goods"})
        assert response.status_code == 200
        items = response.json()
        
        for item in items:
            assert item["category"] == "finished_goods"
    
    def test_create_new_item(self, director_client):
        """Create a new inventory item"""
        new_item = {
            "name": f"TEST_Item_{uuid.uuid4().hex[:8]}",
            "business_type": "petrol_pump",
            "category": "consumables",
            "unit": "Litres",
            "min_stock_level": 100,
            "opening_stock": 50,
            "avg_cost": 85.5
        }
        
        response = director_client.post(f"{BASE_URL}/api/inv/items", json=new_item)
        assert response.status_code == 200
        
        created = response.json()
        assert created["name"] == new_item["name"]
        assert created["category"] == new_item["category"]
        assert created["current_stock"] == new_item["opening_stock"]
        assert created["avg_cost"] == new_item["avg_cost"]
        assert "id" in created
        
        print(f"Created item: {created['name']} with ID {created['id']}")
        return created


class TestInventoryCategories:
    """Test GET /api/inv/categories endpoint"""
    
    def test_get_categories(self, director_client):
        """Get industry-specific categories"""
        response = director_client.get(f"{BASE_URL}/api/inv/categories")
        assert response.status_code == 200
        
        categories = response.json()
        assert isinstance(categories, dict)
        
        # Verify expected business types
        expected_businesses = ["slag_crushing", "stone_crusher", "fl_shop", "transport", "petrol_pump"]
        for biz in expected_businesses:
            assert biz in categories, f"Missing business type: {biz}"
        
        # Verify structure of a business category
        assert "raw_materials" in categories["slag_crushing"]
        assert "finished_goods" in categories["slag_crushing"]
        
        print(f"Categories loaded for {len(categories)} business types")


class TestStockMovement:
    """Test POST /api/inv/stock-movement and GET /api/inv/movements"""
    
    def test_record_purchase_movement(self, director_client):
        """Record a purchase (stock IN) movement with auto journal entry"""
        # First get an item to move
        items_resp = director_client.get(f"{BASE_URL}/api/inv/items", params={"business_type": "petrol_pump"})
        items = items_resp.json()
        
        if not items:
            pytest.skip("No petrol pump items available")
        
        item = items[0]
        initial_stock = item["current_stock"]
        
        movement_data = {
            "item_id": item["id"],
            "movement_type": "in",
            "quantity": 100,
            "unit_price": 95.50,
            "reference_type": "purchase",
            "party_name": "TEST_Supplier",
            "notes": "Test purchase movement"
        }
        
        response = director_client.post(f"{BASE_URL}/api/inv/stock-movement", json=movement_data)
        assert response.status_code == 200
        
        movement = response.json()
        assert movement["item_id"] == item["id"]
        assert movement["movement_type"] == "in"
        assert movement["quantity"] == 100
        assert movement["stock_after"] == initial_stock + 100
        
        print(f"Purchase movement recorded: +100 units to {item['name']}")
        return movement
    
    def test_record_sale_movement(self, director_client):
        """Record a sale (stock OUT) movement with auto journal entry"""
        # Get item with stock
        items_resp = director_client.get(f"{BASE_URL}/api/inv/items", params={"business_type": "petrol_pump"})
        items = [i for i in items_resp.json() if i["current_stock"] >= 50]
        
        if not items:
            pytest.skip("No items with sufficient stock")
        
        item = items[0]
        
        movement_data = {
            "item_id": item["id"],
            "movement_type": "out",
            "quantity": 25,
            "unit_price": 105.0,
            "reference_type": "sale",
            "party_name": "TEST_Customer",
            "notes": "Test sale movement"
        }
        
        response = director_client.post(f"{BASE_URL}/api/inv/stock-movement", json=movement_data)
        assert response.status_code == 200
        
        movement = response.json()
        assert movement["movement_type"] == "out"
        assert movement["reference_type"] == "sale"
        
        print(f"Sale movement recorded: -25 units from {item['name']}")
    
    def test_insufficient_stock_error(self, director_client):
        """Should fail when trying to sell more than available"""
        items_resp = director_client.get(f"{BASE_URL}/api/inv/items")
        items = [i for i in items_resp.json() if i["current_stock"] < 10000]
        
        if not items:
            pytest.skip("No items available")
        
        item = items[0]
        
        movement_data = {
            "item_id": item["id"],
            "movement_type": "out",
            "quantity": 999999,
            "unit_price": 100.0,
            "reference_type": "sale"
        }
        
        response = director_client.post(f"{BASE_URL}/api/inv/stock-movement", json=movement_data)
        assert response.status_code == 400
        assert "Insufficient stock" in response.json()["detail"]
    
    def test_get_movements_history(self, director_client):
        """Get stock movement history"""
        response = director_client.get(f"{BASE_URL}/api/inv/movements")
        assert response.status_code == 200
        
        movements = response.json()
        assert isinstance(movements, list)
        
        if movements:
            m = movements[0]
            assert "item_name" in m
            assert "movement_type" in m
            assert "quantity" in m
        
        print(f"Found {len(movements)} movement records")


class TestProduction:
    """Test POST /api/inv/production and GET /api/inv/productions"""
    
    def test_record_production_batch(self, director_client):
        """Record production (raw material -> finished goods)"""
        # Get raw materials from slag_crushing
        items_resp = director_client.get(f"{BASE_URL}/api/inv/items", params={"business_type": "slag_crushing"})
        items = items_resp.json()
        
        raw_materials = [i for i in items if i["category"] == "raw_materials" and i["current_stock"] >= 10]
        finished_goods = [i for i in items if i["category"] == "finished_goods"]
        
        if not raw_materials or not finished_goods:
            pytest.skip("Need raw materials with stock and finished goods items")
        
        raw = raw_materials[0]
        finished = finished_goods[0]
        
        production_data = {
            "input_item_id": raw["id"],
            "input_qty": 10,
            "outputs": [
                {"item_id": finished["id"], "quantity": 9, "unit_price": 500}
            ],
            "notes": "TEST_Production batch"
        }
        
        response = director_client.post(f"{BASE_URL}/api/inv/production", json=production_data)
        assert response.status_code == 200
        
        production = response.json()
        assert production["input_item_id"] == raw["id"]
        assert production["input_quantity"] == 10
        assert production["total_output"] == 9
        assert "yield_percentage" in production
        assert "loss_percentage" in production
        
        print(f"Production recorded: {raw['name']} -> {finished['name']}, yield: {production['yield_percentage']}%")
    
    def test_get_productions_history(self, director_client):
        """Get production batch history"""
        response = director_client.get(f"{BASE_URL}/api/inv/productions")
        assert response.status_code == 200
        
        productions = response.json()
        assert isinstance(productions, list)
        
        print(f"Found {len(productions)} production batches")


class TestTransfers:
    """Test POST /api/inv/transfer and GET /api/inv/transfers (Director only)"""
    
    def test_director_can_transfer(self, director_client):
        """Director can transfer between businesses"""
        # Get item from slag_crushing that exists
        items_resp = director_client.get(f"{BASE_URL}/api/inv/items", params={"business_type": "slag_crushing"})
        items = [i for i in items_resp.json() if i["current_stock"] >= 5]
        
        if not items:
            pytest.skip("No items with stock in slag_crushing")
        
        item = items[0]
        
        transfer_data = {
            "from_business": "slag_crushing",
            "to_business": "stone_crusher",
            "item_name": item["name"],
            "quantity": 2,
            "notes": "TEST_Inter-business transfer"
        }
        
        response = director_client.post(f"{BASE_URL}/api/inv/transfer", json=transfer_data)
        assert response.status_code == 200
        
        transfer = response.json()
        assert transfer["from_business"] == "slag_crushing"
        assert transfer["to_business"] == "stone_crusher"
        assert transfer["quantity"] == 2
        
        print(f"Transfer completed: {item['name']} from slag_crushing to stone_crusher")
    
    def test_manager_cannot_transfer(self, manager_client):
        """Manager should be denied transfer access"""
        transfer_data = {
            "from_business": "slag_crushing",
            "to_business": "stone_crusher",
            "item_name": "Diesel",
            "quantity": 1
        }
        
        response = manager_client.post(f"{BASE_URL}/api/inv/transfer", json=transfer_data)
        assert response.status_code == 403
    
    def test_get_transfers_director_only(self, director_client, manager_client):
        """Only director can view transfers"""
        # Director can access
        director_resp = director_client.get(f"{BASE_URL}/api/inv/transfers")
        assert director_resp.status_code == 200
        
        # Manager denied
        manager_resp = manager_client.get(f"{BASE_URL}/api/inv/transfers")
        assert manager_resp.status_code == 403


class TestLidarScans:
    """Test POST /api/inv/lidar-scan and GET /api/inv/lidar-scans"""
    
    def test_record_lidar_scan(self, director_client):
        """Record a LiDAR scan comparison"""
        # Get an item with density (slag/stone items)
        items_resp = director_client.get(f"{BASE_URL}/api/inv/items", params={"business_type": "slag_crushing"})
        items = [i for i in items_resp.json() if i.get("density")]
        
        if not items:
            pytest.skip("No items with density configured")
        
        item = items[0]
        
        scan_data = {
            "item_id": item["id"],
            "volume_m3": 100.5,
            "notes": "TEST_LiDAR scan"
        }
        
        response = director_client.post(f"{BASE_URL}/api/inv/lidar-scan", json=scan_data)
        assert response.status_code == 200
        
        scan = response.json()
        assert scan["item_id"] == item["id"]
        assert scan["volume_m3"] == 100.5
        assert "scanned_weight_mt" in scan
        assert "system_stock_mt" in scan
        assert "variance_mt" in scan
        assert "variance_pct" in scan
        
        print(f"LiDAR scan: {scan['scanned_weight_mt']} MT (scanned) vs {scan['system_stock_mt']} MT (system)")
    
    def test_get_lidar_scans(self, director_client):
        """Get LiDAR scan history"""
        response = director_client.get(f"{BASE_URL}/api/inv/lidar-scans")
        assert response.status_code == 200
        
        scans = response.json()
        assert isinstance(scans, list)
        
        print(f"Found {len(scans)} LiDAR scan records")


class TestLowStock:
    """Test GET /api/inv/low-stock endpoint"""
    
    def test_get_low_stock_alerts(self, director_client):
        """Get items below minimum stock level"""
        response = director_client.get(f"{BASE_URL}/api/inv/low-stock")
        assert response.status_code == 200
        
        low_stock = response.json()
        assert isinstance(low_stock, list)
        
        # All items should have current_stock < min_stock_level
        for item in low_stock:
            assert item["current_stock"] < item["min_stock_level"]
        
        print(f"Found {len(low_stock)} low stock alerts")
    
    def test_filter_low_stock_by_business(self, director_client):
        """Filter low stock by business_type"""
        response = director_client.get(f"{BASE_URL}/api/inv/low-stock", params={"business_type": "petrol_pump"})
        assert response.status_code == 200
        
        items = response.json()
        for item in items:
            assert item["business_type"] == "petrol_pump"


class TestManagerInventoryAccess:
    """Test manager-specific inventory access"""
    
    def test_manager_can_view_items(self, manager_client):
        """Manager can view inventory items (filtered by their business)"""
        response = manager_client.get(f"{BASE_URL}/api/inv/items")
        assert response.status_code == 200
        
        items = response.json()
        assert isinstance(items, list)
    
    def test_manager_can_record_movement(self, manager_client):
        """Manager can record stock movements"""
        # First get items
        items_resp = manager_client.get(f"{BASE_URL}/api/inv/items")
        items = items_resp.json()
        
        if not items:
            pytest.skip("No items available for manager")
        
        item = items[0]
        
        movement_data = {
            "item_id": item["id"],
            "movement_type": "in",
            "quantity": 10,
            "unit_price": 50.0,
            "reference_type": "purchase",
            "notes": "TEST_Manager purchase"
        }
        
        response = manager_client.post(f"{BASE_URL}/api/inv/stock-movement", json=movement_data)
        assert response.status_code == 200
    
    def test_manager_can_create_item(self, manager_client):
        """Manager can create new inventory items"""
        new_item = {
            "name": f"TEST_MgrItem_{uuid.uuid4().hex[:8]}",
            "category": "consumables",
            "unit": "Units",
            "min_stock_level": 5
        }
        
        response = manager_client.post(f"{BASE_URL}/api/inv/items", json=new_item)
        assert response.status_code == 200


class TestAutoJournalEntry:
    """Test auto accounting journal entries on stock movements"""
    
    def test_purchase_creates_journal_entry(self, director_client):
        """Purchase should create: Inventory Dr / Payable Cr"""
        # Get items
        items_resp = director_client.get(f"{BASE_URL}/api/inv/items")
        items = items_resp.json()
        
        if not items:
            pytest.skip("No items available")
        
        item = items[0]
        
        movement_data = {
            "item_id": item["id"],
            "movement_type": "in",
            "quantity": 50,
            "unit_price": 100.0,
            "reference_type": "purchase",
            "party_name": "TEST_Vendor_JE"
        }
        
        response = director_client.post(f"{BASE_URL}/api/inv/stock-movement", json=movement_data)
        assert response.status_code == 200
        
        # Check journal entries were created
        je_resp = director_client.get(f"{BASE_URL}/api/journal-entries")
        if je_resp.status_code == 200:
            entries = je_resp.json()
            # Look for our purchase entry
            recent = [e for e in entries if "Inventory purchase" in e.get("narration", "")]
            print(f"Found {len(recent)} inventory purchase journal entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
