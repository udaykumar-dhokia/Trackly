from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_api_key_or_ip(request: Request) -> str:
    """
    Identifies the client for rate limiting.
    1. Tries to extract API Key from Authorization header.
    2. Falls back to remote IP address.
    """
    auth = request.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth.split(" ")[1]
    
    return get_remote_address(request)

limiter = Limiter(key_func=get_api_key_or_ip)