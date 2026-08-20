from django.conf import settings
from django.http import HttpResponse


class SimpleCORSMiddleware:
    """Add CORS headers for configured frontend origins without external deps."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS":
            response = HttpResponse(status=200)
        else:
            response = self.get_response(request)

        origin = request.headers.get("Origin", "")
        allow_all = getattr(settings, "CORS_ALLOW_ALL_ORIGINS", False)
        allow_credentials = getattr(settings, "CORS_ALLOW_CREDENTIALS", False)
        allowed_origins = set(getattr(settings, "CORS_ALLOWED_ORIGINS", []))

        if allow_credentials:
            if origin and origin in allowed_origins:
                response["Access-Control-Allow-Origin"] = origin
        else:
            if allow_all:
                response["Access-Control-Allow-Origin"] = "*"
            elif origin and origin in allowed_origins:
                response["Access-Control-Allow-Origin"] = origin

        if "Access-Control-Allow-Origin" in response:
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response["Access-Control-Max-Age"] = "86400"
            if allow_credentials:
                response["Access-Control-Allow-Credentials"] = "true"

        return response
