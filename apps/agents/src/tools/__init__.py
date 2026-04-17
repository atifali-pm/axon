from .db_query import db_query
from .rag_search import rag_search
from .web_search import web_search

TOOLS = [web_search, rag_search, db_query]
