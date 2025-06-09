#!/usr/bin/env python3
"""
Simple test script to validate the Scepter Server API endpoints
"""
import requests
import sys

BASE_URL = "http://localhost:5000"

def test_health():
    """Test the health endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        if response.status_code == 200:
            print("✓ Health check passed")
            return True
        else:
            print(f"✗ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Health check failed: {e}")
        return False

def test_list_games():
    """Test listing games"""
    try:
        response = requests.get(f"{BASE_URL}/api/list-games")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ List games passed - Found {len(data.get('games', []))} games")
            return True
        else:
            print(f"✗ List games failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ List games failed: {e}")
        return False

def test_create_game():
    """Test creating a new game"""
    try:
        test_data = {
            "gameName": "Test Game API",
            "players": [
                {"name": "Player 1"},
                {"name": "Player 2"},
                {"name": "Player 3"}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/create-game",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print("✓ Create game passed")
            return True
        elif response.status_code == 400:
            data = response.json()
            if "already exists" in data.get("error", ""):
                print("✓ Create game validation working (game already exists)")
                return True
            else:
                print(f"✗ Create game failed: {data.get('error')}")
                return False
        else:
            print(f"✗ Create game failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Create game failed: {e}")
        return False

def main():
    """Run all tests"""
    print("Testing Scepter Server API...")
    print("-" * 40)
    
    tests = [
        test_health,
        test_list_games,
        test_create_game
    ]
    
    passed = 0
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("-" * 40)
    print(f"Results: {passed}/{len(tests)} tests passed")
    
    if passed == len(tests):
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
