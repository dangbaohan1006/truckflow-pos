from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from .service import print_receipt

router = APIRouter()


class PrinterConfig(BaseModel):
    type: str = Field(..., example='network')
    host: Optional[str]
    port: Optional[int] = 9100
    idVendor: Optional[int]
    idProduct: Optional[int]


class PrintRequest(BaseModel):
    printer: Optional[PrinterConfig] = None
    lines: List[str]


@router.post('/api/print', tags=['Print'])
async def api_print(req: PrintRequest):
    try:
        print_receipt(req.lines, printer=req.printer.dict())
        return { 'status': 'queued' }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail='print failed: ' + str(e))
