import requests
import json
from datetime import datetime

response = requests.get('http://localhost:3000/api/sports')
data = response.json()
records = data.get('records', [])

print('All records in database:\n')
for r in records:
    try:
        value = json.loads(r.get('value', '{}')) if isinstance(r.get('value'), str) else r.get('value', {})
        start_time = value.get('start_time', 0)
        duration = value.get('duration', 0)
        
        if start_time and duration > 0:
            date = datetime.fromtimestamp(start_time)
            sport_type = value.get('sport_type')
            category = r.get('category', 'N/A')
            
            print(f"{date.strftime('%Y-%m-%d %H:%M')} | sport_type={sport_type} | category={category} | dur={duration/60:.1f}min")
    except Exception as e:
        pass
