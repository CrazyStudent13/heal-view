import requests
import json

# 获取时间序列数据
date = '2026-07-04'  # 使用一个有数据的日期
response = requests.get(f'http://localhost:3000/api/dates/{date}/heart_rate')
data = response.json()

print('Heart rate time series data:')
print(json.dumps(data, indent=2))

# 打印前几条数据的详细信息
if data.get('data'):
    print('\nFirst 5 records details:')
    for i, item in enumerate(data['data'][:5]):
        print(f"{i+1}. Time: {item['time']} | Value: {item['value']}")
