import sqlite3
import json

conn = sqlite3.connect('backend/health_data.db')
cursor = conn.cursor()

# Check for duplicate heart rate data
cursor.execute("""
    SELECT date, time, COUNT(*) as count
    FROM fitness_data 
    WHERE key='heart_rate' AND date='2026-06-29'
    GROUP BY date, time
    HAVING COUNT(*) > 1
""")
duplicates = cursor.fetchall()

print(f"Found {len(duplicates)} duplicate entries:")
for dup in duplicates[:5]:  # Show first 5
    print(f"Date: {dup[0]}, Time: {dup[1]}, Count: {dup[2]}")

conn.close()
