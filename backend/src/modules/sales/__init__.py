"""Sales package initializer.

Expose the `router` submodule as the `router` attribute on the package
so tests that do `from src.modules.sales import router as sales_router`
receive the module object (which contains `get_session`/`save_outbox`)
instead of an `APIRouter` instance.
"""

from . import router as router  # noqa: F401

__all__ = ["router"]
