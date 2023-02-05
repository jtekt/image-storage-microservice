import requests

STORAGE_SERVCICE_URL = 'http://localhost:31221'

imageListUrl = f'{STORAGE_SERVCICE_URL}?limit=3'
imageListResponse = requests.get(imageListUrl)
imageList = imageListResponse.json()['items']

for imageItem in imageList:

  imageId = imageItem['_id']
  imageFileName = imageItem['file']
  imageUrl = f'{BASE_URL}/{imageId}/image'
  
  imageResponse = requests.get(imageUrl)
  with open(imageFileName, 'wb') as file:
    file.write(imageResponse.content)
