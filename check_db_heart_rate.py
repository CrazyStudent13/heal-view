import sqlite3
import json

conn = sqlite3.connect('backend/health_data.db')
cursor = conn.cursor()

# Check heart rate data
cursor.execute("SELECT date, time, key, value FROM fitness_data WHERE key='heart_rate' LIMIT 5")
rows = cursor.fetchall()

print('Heart rate data in database:')
for row in rows:
    print(f"Date: {row[0]}, Time: {row[1]}, Key: {row[2]}")
    try:
        value = json.loads(row[3]) if isinstance(row[3], str) else row[3]
        print(f"  Value (JSON): {json.dumps(value, indent=2)}")
    except:
        print(f"  Value: {row[3]}")
    print()

conn.close()
