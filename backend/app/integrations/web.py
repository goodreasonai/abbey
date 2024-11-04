from ..configs.secrets import BING_API_KEY
import requests
import sys

"""

To integrate a new search engine API, implement the SearchEngine class.

The main functions return SearchResult or ImageSearchResult objects.

"""

class SearchResult():
    name: str
    url: str
    def __init__(self, name, url) -> None:
        self.name = name
        self.url = url
    def to_json(self):
        return {'name': self.name, 'url': self.url}


class ImageSearchResult(SearchResult):
    def __init__(self, name, url) -> None:
        super().__init__(name, url)


class SearchEngine():
    def __init__(self, code, supports_image_search) -> None:
        self.code = code
        self.supports_image_search = supports_image_search

    def search(self, query):
        raise Exception(f"Search not implemented for search engine with code '{self.code}'")
    
    def image_search(self, query, n=5):
        raise Exception(f"Search not implemented for search engine with code '{self.code}'")


class Bing(SearchEngine):
    def __init__(self) -> None:
        super().__init__(
            code="bing",
            supports_image_search=True
        )
    
    def search(self, query):
        endpoint = "https://api.bing.microsoft.com/v7.0/search"
        mkt = 'en-US'
        params = { 'q': query, 'mkt': mkt }
        headers = { 'Ocp-Apim-Subscription-Key': BING_API_KEY }
        response = requests.get(endpoint, headers=headers, params=params)
        response.raise_for_status()  # will throw an error if the request isn't good
        my_json = response.json()
        try:
            raw_results = my_json['webPages']['value']
        except:
            print(f"Could not get web pages from search engine. Here was the repsonse: {my_json}", file=sys.stderr)
            return []
        
        results = [SearchResult(x['name'], x['url']) for x in raw_results]
        return results
    
    def image_search(self, query, n=5):
        # Documentation: https://learn.microsoft.com/en-us/bing/search-apis/bing-image-search/reference/response-objects
        endpoint = "https://api.bing.microsoft.com/v7.0/images/search"
        mkt = 'en-US'
        params = { 'q': query, 'mkt': mkt, 'count': n }
        headers = {'Ocp-Apim-Subscription-Key': BING_API_KEY }
        response = requests.get(endpoint, headers=headers, params=params)
        response.raise_for_status()  # will throw an error if the request isn't good
        my_json = response.json()
        images = my_json['value']
        results = [ImageSearchResult(x['name'], x['contentUrl']) for x in images]
        return results


SEARCH_PROVIDERS = {
    'bing': Bing()
}

