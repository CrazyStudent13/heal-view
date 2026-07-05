import sqlite3
import json
from datetime import datetime

conn = sqlite3.connect('backend/health_data.db')
cursor = conn.cursor()

# Get all heart rate timestamps for a specific date
date = '2026-06-29'
cursor.execute("""
    SELECT time, value 
    FROM fitness_data 
    WHERE key='heart_rate' AND date=?
    ORDER BY time ASC
""", (date,))

rows = cursor.fetchall()

print(f"Heart rate data for {date}:")
print(f"Total records: {len(rows)}")

if rows:
    # Remove duplicates
    seen = set()
    unique_rows = []
    for row in rows:
        if row[0] not in seen:
            seen.add(row[0])
            unique_rows.append(row)
    
    print(f"Unique records: {len(unique_rows)}")
    
    # Show first and last few timestamps
    print("\nFirst 5 timestamps:")
    for i, (time, value) in enumerate(unique_rows[:5]):
        dt = datetime.fromtimestamp(time)
        print(f"  {i+1}. {dt.strftime('%Y-%m-%d %H:%M:%S')} - BPM: {value}")
    
    print("\nLast 5 timestamps:")
    for i, (time, value) in enumerate(unique_rows[-5:]):
        dt = datetime.fromtimestamp(time)
        print(f"  {len(unique_rows)-5+i+1}. {dt.strftime('%Y-%m-%d %H:%M:%S')} - BPM: {value}")
    
    # Show time range
    first_time = datetime.fromtimestamp(unique_rows[0][0])
    last_time = datetime.fromtimestamp(unique_rows[-1][0])
    print(f"\nTime range: {first_time.strftime('%H:%M')} to {last_time.strftime('%H:%M')}")

conn.close()
