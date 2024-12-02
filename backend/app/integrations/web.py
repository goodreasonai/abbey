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


class SearchEngine():
    def __init__(self, code, name, desc, traits) -> None:
        self.code = code
        self.name = name
        self.desc = desc
        self.traits = traits

    def search(self, query):
        raise Exception(f"Search not implemented for search engine with code '{self.code}'")
    
    def to_json_obj(self):
        return {
            'code': self.code,
            'name': self.name,
            'desc': self.desc,
            'traits': self.traits
        }


class Bing(SearchEngine):
    def __init__(self) -> None:
        super().__init__(
            code="bing",
            name="Bing",
            desc="Searches over the entire web. Microsoft's search engine.",
            traits="Web",
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


class SearXNG(SearchEngine):
    def __init__(self) -> None:
        super().__init__(
            code="searxng",
            name="SearXNG",
            desc="An open source meta search engine",
            traits="Self-Hosted",
        )
    
    def search(self, query):
        # TODO
        return []


SEARCH_PROVIDERS = {
    'bing': Bing(),
    'searxng': SearXNG()
}

