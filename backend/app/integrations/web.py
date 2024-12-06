from ..configs.secrets import BING_API_KEY, SEARXNG_URL, SEARXNG_OPTIONS
import requests
import sys
import json

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

    def search(self, query, max_n=10):
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
    
    def search(self, query, max_n=10):
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
        
        results = [SearchResult(x['name'], x['url']) for i, x in enumerate(raw_results) if i < max_n]
        return results


class SearXNG(SearchEngine):
    def __init__(self, engine_code="", name="", use_pdf=False) -> None:
        self.engine_code = engine_code
        self.use_pdf = use_pdf
        code = "searxng" if not engine_code else f"searxng-{engine_code}"
        real_name = "SearXNG"
        if not name:
            if engine_code:
                real_name += f"-{engine_code}"
        else:
            real_name = name

        super().__init__(
            code=code,
            name=real_name,
            desc="An open source meta search engine",
            traits="Self-Hosted",
        )

    def search(self, query, max_n=10):
        params = {'q': query, 'format': 'json'}
        if self.engine_code:
            params['engines'] = self.engine_code
        response = requests.get(f"{SEARXNG_URL}/search", params=params)
        my_json = response.json()
        results = my_json['results']
        result_objs = []
        for i, res in enumerate(results):
            if i >= max_n:
                break
            # Using the PDF url instead of the regularly URL can be useful for scholarly works
            if self.use_pdf:
                if 'pdf_url' in res and res['pdf_url']:
                    result_objs.append(SearchResult(res['title'], res['pdf_url']))
                else:
                    result_objs.append(SearchResult(res['title'], res['url']))
            else:
                result_objs.append(SearchResult(res['title'], res['url']))
        return result_objs


def gen_searxng_engines():

    if not SEARXNG_URL:
        return []
    
    enabled = [SearXNG()]
    
    if not SEARXNG_OPTIONS:
        return enabled
    
    searxng_options = json.loads(SEARXNG_OPTIONS)
    if not len(SEARXNG_OPTIONS):
        return enabled

    for engine in searxng_options:
        name = engine['name'] if 'name' in engine else ""
        use_pdf = engine['pdf'] if 'pdf' in engine else False
        engine_code = engine['engine']
        enabled.append(SearXNG(name=name, engine_code=engine_code, use_pdf=use_pdf))
    return enabled

searxng_engines = {x.code: x for x in gen_searxng_engines()}


SEARCH_PROVIDERS = {
    'bing': Bing(),
    **searxng_engines
}

